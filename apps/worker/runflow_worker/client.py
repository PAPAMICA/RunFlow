"""HTTP client for worker API."""

from __future__ import annotations

from typing import Any

import httpx

from runflow_worker.config import get_settings


class WorkerAPIClient:
    def __init__(self, api_url: str | None = None, token: str | None = None):
        settings = get_settings()
        self.api_url = (api_url or settings.api_url).rstrip("/")
        self.token = token or settings.worker_token
        self._client = httpx.AsyncClient(
            base_url=f"{self.api_url}/api/v1/worker",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=60.0,
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def heartbeat(self, hostname: str, version: str, current_runs: int) -> dict[str, Any]:
        response = await self._client.post(
            "/heartbeat",
            json={"hostname": hostname, "version": version, "current_runs": current_runs},
        )
        try:
            return response.json() if response.content else {}
        except Exception:
            return {}

    async def claim(self) -> dict[str, Any] | None:
        response = await self._client.post("/claim", timeout=30.0)
        if response.status_code == 200 and response.content:
            data = response.json()
            return data if data else None
        return None

    async def accept(self, run_id: str) -> None:
        await self._client.post(f"/runs/{run_id}/accept")

    async def push_logs(self, run_id: str, entries: list[dict]) -> None:
        await self._client.post(f"/runs/{run_id}/logs", json={"entries": entries})

    async def submit_result(self, run_id: str, payload: dict) -> None:
        await self._client.post(f"/runs/{run_id}/result", json=payload)

    async def report_failure(self, run_id: str, payload: dict) -> None:
        await self._client.post(f"/runs/{run_id}/fail", json=payload)

    async def report_cancelled(self, run_id: str) -> None:
        await self._client.post(f"/runs/{run_id}/cancelled")
