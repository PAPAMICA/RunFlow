"""Health and readiness endpoints."""

from fastapi import APIRouter
from sqlalchemy import text

from runflow_api.db import engine
from runflow_api.services.valkey import check_valkey_health

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/ready")
async def ready():
    db_ok = False
    valkey_ok = await check_valkey_health()
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        db_ok = False

    status = "ready" if db_ok and valkey_ok else "not_ready"
    return {"status": status, "database": db_ok, "valkey": valkey_ok}
