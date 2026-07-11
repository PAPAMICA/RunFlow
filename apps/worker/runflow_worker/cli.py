"""Worker CLI."""

from __future__ import annotations

import asyncio
import re
import socket
from pathlib import Path

import httpx
import typer

from runflow_worker import __version__
from runflow_worker.agent import WorkerAgent
from runflow_worker.config import get_settings

app = typer.Typer(name="runflow-worker", help="RunFlow worker CLI")


@app.command("version")
def version_cmd():
    typer.echo(f"RunFlow Worker {__version__}")


def _update_env_file(env_file: Path, api_url: str, worker_token: str) -> None:
    lines: list[str] = []
    if env_file.exists():
        lines = env_file.read_text().splitlines()

    updates = {
        "RUNFLOW_API_URL": api_url,
        "RUNFLOW_WORKER_TOKEN": worker_token,
    }
    seen: set[str] = set()
    new_lines: list[str] = []
    for line in lines:
        matched = False
        for key, value in updates.items():
            if re.match(rf"^{re.escape(key)}=", line):
                new_lines.append(f"{key}={value}")
                seen.add(key)
                matched = True
                break
        if not matched:
            new_lines.append(line)
    for key, value in updates.items():
        if key not in seen:
            new_lines.append(f"{key}={value}")
    env_file.write_text("\n".join(new_lines) + "\n")


@app.command("register")
def register(
    server: str = typer.Option(..., "--server", help="RunFlow API base URL"),
    registration_token: str = typer.Option(..., "--registration-token"),
    name: str | None = typer.Option(None, "--name"),
    env_file: Path = typer.Option(Path(".env"), "--env-file", help="File to store worker credentials"),
):
    hostname = socket.gethostname()
    try:
        response = httpx.post(
            f"{server.rstrip('/')}/api/v1/worker/register",
            json={"registration_token": registration_token, "hostname": hostname, "name": name},
            timeout=30.0,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        typer.echo(f"Registration failed: {exc}", err=True)
        raise typer.Exit(1) from exc

    data = response.json()
    _update_env_file(env_file, server.rstrip("/"), data["token"])
    typer.echo(f"Worker registered: {data['worker_id']}")
    typer.echo(f"Credentials saved to {env_file.resolve()}")
    typer.echo("Run `runflow-worker start` to begin processing jobs.")


@app.command("start")
def start():
    import logging

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    settings = get_settings()
    if not settings.worker_token:
        typer.echo("RUNFLOW_WORKER_TOKEN is required. Run `runflow-worker register` first.", err=True)
        raise typer.Exit(1)
    typer.echo(f"Starting worker, API: {settings.api_url}")
    asyncio.run(WorkerAgent().start())


if __name__ == "__main__":
    app()
