"""FastAPI application entrypoint."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from runflow_api import __version__
from runflow_api.api import (
    ai, api_keys, auth, credentials, dashboard, health, hooks, inventories,
    jobs, mailboxes, metrics, runs, secrets, triggers, workers, workers_admin, workflows,
)
from runflow_api.config import get_settings
from runflow_api.logging_config import setup_logging
from runflow_api.services.email_poller import email_poller_loop
from runflow_api.services.scheduler import scheduler_loop
from runflow_api.services.worker_health import worker_health_loop
from runflow_api.services.valkey import close_valkey
from runflow_api.db import async_session_factory

logger = logging.getLogger(__name__)


async def _reconciliation_loop() -> None:
    from runflow_api.services.queue import reconcile_queued_runs
    settings = get_settings()
    while True:
        try:
            async with async_session_factory() as session:
                count = await reconcile_queued_runs(session)
                await session.commit()
                if count:
                    logger.info("Reconciled %d queued runs", count)
        except Exception:
            logger.exception("Reconciliation failed")
        await asyncio.sleep(settings.reconciliation_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging("api")
    tasks = [
        asyncio.create_task(_reconciliation_loop()),
        asyncio.create_task(scheduler_loop()),
        asyncio.create_task(email_poller_loop()),
        asyncio.create_task(worker_health_loop()),
    ]
    yield
    for task in tasks:
        task.cancel()
    for task in tasks:
        try:
            await task
        except asyncio.CancelledError:
            pass
    await close_valkey()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version=__version__, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(metrics.router)
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(jobs.router, prefix="/api/v1")
    app.include_router(runs.router, prefix="/api/v1")
    app.include_router(api_keys.router, prefix="/api/v1")
    app.include_router(dashboard.router, prefix="/api/v1")
    app.include_router(workers_admin.router, prefix="/api/v1")
    app.include_router(workers.router, prefix="/api/v1")
    app.include_router(secrets.router, prefix="/api/v1")
    app.include_router(credentials.router, prefix="/api/v1")
    app.include_router(triggers.router, prefix="/api/v1")
    app.include_router(hooks.router, prefix="/api/v1")
    app.include_router(workflows.router, prefix="/api/v1")
    app.include_router(mailboxes.router, prefix="/api/v1")
    app.include_router(inventories.router, prefix="/api/v1")
    app.include_router(ai.router, prefix="/api/v1")

    return app


app = create_app()
