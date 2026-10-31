"""Arq worker settings and redis connection configuration."""

from typing import ClassVar

from arq.cron import cron

from app.workers.jobs import (
    diagnose_and_call,
    escalate,
    ingest_manual,
    offline_sweep,
    retry_call,
    send_test_call,
)
from app.workers.queue import enqueue_job, get_arq_pool, get_redis_settings

__all__ = [
    "WorkerSettings",
    "diagnose_and_call",
    "enqueue_job",
    "escalate",
    "get_arq_pool",
    "get_redis_settings",
    "ingest_manual",
    "offline_sweep",
    "retry_call",
    "send_test_call",
]


class WorkerSettings:
    """Arq worker configuration."""

    redis_settings = get_redis_settings()
    max_tries = 3
    functions: ClassVar[list[object]] = [
        diagnose_and_call,
        retry_call,
        escalate,
        send_test_call,
        ingest_manual,
        offline_sweep,
    ]
    cron_jobs: ClassVar[list[object]] = [cron(offline_sweep, minute=set(range(0, 60, 5)))]
