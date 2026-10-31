"""Machine routes strictly scoped by owner."""

from datetime import UTC, datetime, timedelta

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_redis
from app.db.models import Machine, TrendPoint, User
from app.db.repositories.events import count_open_events_by_machine
from app.db.repositories.machines import (
    create_machine,
    get_machine_by_id,
    list_machines_by_owner,
)
from app.db.session import get_db
from app.errors import NotFoundError, RateLimitedError
from app.ids import generate_id
from app.schemas.machine import MachineCreate, MachineOut, MachineUpdate
from app.schemas.pagination import Page
from app.schemas.trend import TestCallAccepted, TrendOut, TrendPointOut
from app.services.presence import is_device_online
from app.workers.queue import enqueue_job

router = APIRouter(prefix="/v1/machines", tags=["machines"])


async def _to_machine_out(
    machine: Machine,
    session: AsyncSession,
    redis_client: aioredis.Redis,
) -> MachineOut:
    """Transform Machine ORM entity to MachineOut schema with presence and open alerts."""
    dev_id = machine.device.id if machine.device else None
    online = await is_device_online(redis_client, dev_id)
    open_alerts = await count_open_events_by_machine(session, machine.id)

    return MachineOut(
        id=machine.id,
        name=machine.name,
        machine_type=machine.machine_type,
        model=machine.model,
        rated_rpm=machine.rated_rpm,
        supervisor_name=machine.supervisor_name,
        supervisor_phone=machine.supervisor_phone,
        backup_phone=machine.backup_phone,
        language=machine.language,
        status=machine.status,  # type: ignore[arg-type]
        device_online=online,
        last_seen_at=machine.device.last_seen_at if machine.device else None,
        created_at=machine.created_at,
        open_alerts=open_alerts,
        factory_id=machine.factory_id,
    )


@router.get("", response_model=Page[MachineOut])
async def list_machines(
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> Page[MachineOut]:
    """List machines owned by the authenticated caller."""
    machines = await list_machines_by_owner(
        session,
        owner_id=current_user.id,
        limit=limit + 1,
        cursor=cursor,
    )
    has_more = len(machines) > limit
    items_to_return = machines[:limit]
    next_cursor = items_to_return[-1].id if has_more and items_to_return else None

    out_items = [await _to_machine_out(m, session, redis_client) for m in items_to_return]
    return Page(items=out_items, next_cursor=next_cursor)


@router.post("", response_model=MachineOut, status_code=status.HTTP_201_CREATED)
async def create_machine_endpoint(
    payload: MachineCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> MachineOut:
    """Register a new machine under the caller's account."""
    machine_id = generate_id("mch_")
    factory_id = payload.factory_id
    if not factory_id:
        from app.db.repositories.factories import get_factory_by_owner_id

        fac = await get_factory_by_owner_id(session, current_user.id)
        if fac:
            factory_id = fac.id

    machine = Machine(
        id=machine_id,
        owner_id=current_user.id,
        factory_id=factory_id,
        name=payload.name,
        machine_type=payload.machine_type,
        model=payload.model,
        rated_rpm=payload.rated_rpm,
        supervisor_name=payload.supervisor_name,
        supervisor_phone=payload.supervisor_phone,
        backup_phone=payload.backup_phone,
        language=payload.language,
        status="LEARNING",
    )
    created = await create_machine(session, machine)
    await session.commit()
    return await _to_machine_out(created, session, redis_client)


@router.get("/{machine_id}", response_model=MachineOut)
async def get_machine(
    machine_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> MachineOut:
    """Fetch machine details, scoped strictly to caller's ownership."""
    machine = await get_machine_by_id(session, machine_id=machine_id, owner_id=current_user.id)
    if not machine:
        raise NotFoundError(message="Machine not found.")
    return await _to_machine_out(machine, session, redis_client)


@router.patch("/{machine_id}", response_model=MachineOut)
async def update_machine(
    machine_id: str,
    payload: MachineUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> MachineOut:
    """Update machine details, scoped strictly to caller's ownership."""
    machine = await get_machine_by_id(session, machine_id=machine_id, owner_id=current_user.id)
    if not machine:
        raise NotFoundError(message="Machine not found.")

    if payload.name is not None:
        machine.name = payload.name
    if payload.supervisor_name is not None:
        machine.supervisor_name = payload.supervisor_name
    if payload.supervisor_phone is not None:
        machine.supervisor_phone = payload.supervisor_phone
    if payload.backup_phone is not None:
        machine.backup_phone = payload.backup_phone
    if payload.language is not None:
        machine.language = payload.language

    await session.commit()
    return await _to_machine_out(machine, session, redis_client)


@router.post(
    "/{machine_id}/test-call",
    response_model=TestCallAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_test_call(
    machine_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> TestCallAccepted:
    """Trigger an onboarding test call (max 3 per day per machine)."""
    machine = await get_machine_by_id(session, machine_id=machine_id, owner_id=current_user.id)
    if not machine:
        raise NotFoundError(message="Machine not found.")

    today = datetime.now(UTC).strftime("%Y%m%d")
    key = f"testcalls:machine:{machine_id}:{today}"
    call_count = await redis_client.incr(key)
    if call_count == 1:
        await redis_client.expire(key, 26 * 3600)

    if call_count > 3:
        raise RateLimitedError(
            message="Daily test call limit of 3 exceeded.",
            details={"machine_id": machine_id, "limit": 3},
        )

    await enqueue_job("send_test_call", machine_id)
    return TestCallAccepted(status="accepted", machine_id=machine_id)


@router.get("/{machine_id}/trend", response_model=TrendOut)
async def get_machine_trend(
    machine_id: str,
    from_ts: datetime | None = Query(default=None, alias="from"),
    to_ts: datetime | None = Query(default=None, alias="to"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> TrendOut:
    """Fetch vibration trend points for machine charts (default last 30 days, max 1000 points)."""
    machine = await get_machine_by_id(session, machine_id=machine_id, owner_id=current_user.id)
    if not machine:
        raise NotFoundError(message="Machine not found.")

    now = datetime.now(UTC)
    start_time = from_ts or (now - timedelta(days=30))
    end_time = to_ts or now

    query = (
        select(TrendPoint)
        .where(
            TrendPoint.machine_id == machine_id,
            TrendPoint.ts >= start_time,
            TrendPoint.ts <= end_time,
        )
        .order_by(TrendPoint.ts.asc())
        .limit(1000)
    )
    result = await session.execute(query)
    points = result.scalars().all()

    out_points = [
        TrendPointOut(
            ts=p.ts,
            rms_g=p.rms_g,
            band_energy=p.band_energy,
            source=p.source,  # type: ignore[arg-type]
        )
        for p in points
    ]
    return TrendOut(machine_id=machine_id, points=out_points)
