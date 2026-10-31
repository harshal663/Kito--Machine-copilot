"""Unit tests for event state machine per ARCHITECTURE.md §5."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.db.models import AuditLog, Event, EventStatus
from app.errors import InvalidStateTransitionError, NotFoundError
from app.services.state_machine import (
    TERMINAL_DECISIONS,
    TERMINAL_STATES,
    VALID_TRANSITIONS,
    apply_transition,
    assert_can_decide,
)


def test_assert_can_decide() -> None:
    """Ensure assert_can_decide allows all states except FAILED."""
    for status in EventStatus:
        if status is EventStatus.FAILED:
            with pytest.raises(InvalidStateTransitionError):
                assert_can_decide(status)
        else:
            assert_can_decide(status)


def test_terminal_states() -> None:
    """Ensure terminal states set contains FAILED and all decision states."""
    assert EventStatus.FAILED in TERMINAL_STATES
    for s in TERMINAL_DECISIONS:
        assert s in TERMINAL_STATES


def test_illegal_terminal_transitions() -> None:
    """Ensure terminal states reject invalid transitions."""
    # FAILED cannot transition anywhere
    assert VALID_TRANSITIONS[EventStatus.FAILED] == set()

    # Decision states can only transition to other decision states
    for decision_state in TERMINAL_DECISIONS:
        targets = VALID_TRANSITIONS[decision_state]
        assert EventStatus.DIAGNOSING not in targets
        assert EventStatus.CALLING not in targets
        assert EventStatus.ANOMALY_DETECTED not in targets
        assert EventStatus.FAILED not in targets


@pytest.mark.asyncio
async def test_apply_transition_success() -> None:
    """Verify apply_transition updates event and creates audit log."""
    event = Event(
        id="evt_01HZX3K2M9V4Q8R7T1Y6N0P5CB",
        machine_id="mch_01HZX3K2M9V4Q8R7T1Y6N0P5CB",
        status=EventStatus.ANOMALY_DETECTED,
        rms_g=0.5,
        z_score=5.0,
        baseline_mean=0.2,
        baseline_std=0.03,
        ts=datetime.now(UTC),
        seq=1,
    )

    session = AsyncMock()
    session.add = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = event
    session.execute.return_value = mock_result

    updated = await apply_transition(
        session=session,
        event_id=event.id,
        to_status=EventStatus.DIAGNOSING,
        actor="system",
        reason="job_started",
    )

    assert updated.status == EventStatus.DIAGNOSING
    session.add.assert_called_once()
    added_obj = session.add.call_args[0][0]
    assert isinstance(added_obj, AuditLog)
    assert added_obj.actor == "system"
    assert added_obj.entity_id == event.id
    assert added_obj.data["from_status"] == "ANOMALY_DETECTED"
    assert added_obj.data["to_status"] == "DIAGNOSING"
    session.flush.assert_awaited_once()


@pytest.mark.asyncio
async def test_apply_transition_decision_state() -> None:
    """Verify decision transition sets decision, decided_at, and decided_by."""
    event = Event(
        id="evt_01HZX3K2M9V4Q8R7T1Y6N0P5CB",
        machine_id="mch_01HZX3K2M9V4Q8R7T1Y6N0P5CB",
        status=EventStatus.CALLING,
        rms_g=0.5,
        z_score=5.0,
        baseline_mean=0.2,
        baseline_std=0.03,
        ts=datetime.now(UTC),
        seq=1,
    )

    session = AsyncMock()
    session.add = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = event
    session.execute.return_value = mock_result

    updated = await apply_transition(
        session=session,
        event_id=event.id,
        to_status=EventStatus.ACKNOWLEDGED,
        actor="usr_01HZX3K2M9V4Q8R7T1Y6N0P5CB",
        reason="operator acknowledged",
    )

    assert updated.status == EventStatus.ACKNOWLEDGED
    assert updated.decision == "ACKNOWLEDGED"
    assert updated.decided_by == "usr_01HZX3K2M9V4Q8R7T1Y6N0P5CB"
    assert updated.decided_at is not None


@pytest.mark.asyncio
async def test_apply_transition_invalid_transition() -> None:
    """Verify InvalidStateTransitionError is raised on illegal transitions."""
    event = Event(
        id="evt_01HZX3K2M9V4Q8R7T1Y6N0P5CB",
        machine_id="mch_01HZX3K2M9V4Q8R7T1Y6N0P5CB",
        status=EventStatus.FAILED,
        rms_g=0.5,
        z_score=5.0,
        baseline_mean=0.2,
        baseline_std=0.03,
        ts=datetime.now(UTC),
        seq=1,
    )

    session = AsyncMock()
    session.add = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = event
    session.execute.return_value = mock_result

    with pytest.raises(InvalidStateTransitionError):
        await apply_transition(
            session=session,
            event_id=event.id,
            to_status=EventStatus.DIAGNOSING,
            actor="system",
        )


@pytest.mark.asyncio
async def test_apply_transition_not_found() -> None:
    """Verify NotFoundError is raised when event does not exist."""
    session = AsyncMock()
    session.add = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    session.execute.return_value = mock_result

    with pytest.raises(NotFoundError):
        await apply_transition(
            session=session,
            event_id="evt_01HZX3K2M9V4Q8R7T1Y6N0P5CB",
            to_status=EventStatus.DIAGNOSING,
            actor="system",
        )
