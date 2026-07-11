"""Worker main loop."""

from __future__ import annotations

import asyncio
import logging
import socket

from runflow_worker import __version__
from runflow_worker.client import WorkerAPIClient
from runflow_worker.config import get_settings
from runflow_worker.runners.base import RunContext
from runflow_worker.runners.docker_executor import DockerExecutor

logger = logging.getLogger(__name__)


class WorkerAgent:
    def __init__(self):
        self.settings = get_settings()
        self.client = WorkerAPIClient()
        self.executor = DockerExecutor()
        self._current_runs = 0

    async def start(self) -> None:
        hostname = socket.gethostname()
        heartbeat_task = asyncio.create_task(self._heartbeat_loop(hostname))

        try:
            while True:
                claim = await self.client.claim()
                if not claim:
                    await asyncio.sleep(1)
                    continue

                asyncio.create_task(self._execute_run(claim))
        finally:
            heartbeat_task.cancel()
            await self.client.close()

    async def _heartbeat_loop(self, hostname: str) -> None:
        while True:
            try:
                await self.client.heartbeat(hostname, __version__, self._current_runs)
            except Exception:
                logger.exception("Heartbeat failed")
            await asyncio.sleep(self.settings.heartbeat_interval)

    async def _execute_run(self, claim: dict) -> None:
        run_id = claim["run_id"]
        self._current_runs += 1
        try:
            await self.client.accept(run_id)
            ctx = RunContext(
                run_id=run_id,
                job=claim["job"],
                arguments=claim.get("arguments", {}),
                workspace_path=claim["workspace_path"],
            )
            output = await self.executor.run(ctx)

            log_entries = getattr(ctx, "_log_entries", [])
            if log_entries:
                batch_size = 50
                for i in range(0, len(log_entries), batch_size):
                    await self.client.push_logs(run_id, log_entries[i : i + batch_size])

            await self.client.submit_result(
                run_id,
                {
                    "exit_code": output.exit_code,
                    "stdout": output.stdout[-10000:],
                    "stderr": output.stderr[-10000:],
                    "result_file_content": output.result_file_content,
                    "error": output.stderr if output.exit_code != 0 else None,
                },
            )
        except Exception as exc:
            logger.exception("Run %s failed", run_id)
            try:
                await self.client.report_failure(run_id, {"exit_code": 1, "error": str(exc)})
            except Exception:
                logger.exception("Failed to report failure for %s", run_id)
        finally:
            self._current_runs -= 1
