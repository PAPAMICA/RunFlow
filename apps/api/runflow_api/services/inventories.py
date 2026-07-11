"""Inventory resolution for runs."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.models import Inventory


async def resolve_inventories_for_run(
    session: AsyncSession,
    inventory_refs: list[str] | None,
) -> list[dict[str, Any]]:
    """Return resolved inventories (internal content) for the given refs.

    Only the ``internal`` source is materialized here (content is shipped to the
    worker). Git-backed inventories are left to the worker to fetch and only
    carry their ``git_config``.
    """
    if not inventory_refs:
        return []
    result = await session.execute(
        select(Inventory).where(Inventory.id.in_(inventory_refs))
    )
    inventories = {inv.id: inv for inv in result.scalars().all()}
    resolved: list[dict[str, Any]] = []
    for ref in inventory_refs:
        inv = inventories.get(ref)
        if inv is None:
            continue
        resolved.append(
            {
                "id": inv.id,
                "name": inv.name,
                "source_type": inv.source_type,
                "content": inv.content or "",
                "git_config": inv.git_config,
            }
        )
    return resolved
