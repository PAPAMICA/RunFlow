"""Base runner interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any


@dataclass
class RunContext:
    run_id: str
    job: dict[str, Any]
    arguments: dict[str, Any]
    workspace_path: str
    env: dict[str, str] = field(default_factory=dict)
    on_system_log: Callable[[str], None] | None = None


@dataclass
class RunOutput:
    exit_code: int
    stdout: str = ""
    stderr: str = ""
    result_file_content: str | None = None


class BaseRunner(ABC):
    @abstractmethod
    async def prepare(self, ctx: RunContext) -> None:
        pass

    @abstractmethod
    async def execute(self, ctx: RunContext) -> RunOutput:
        pass

    @abstractmethod
    async def cleanup(self, ctx: RunContext) -> None:
        pass

    async def run(self, ctx: RunContext) -> RunOutput:
        await self.prepare(ctx)
        try:
            return await self.execute(ctx)
        finally:
            await self.cleanup(ctx)
