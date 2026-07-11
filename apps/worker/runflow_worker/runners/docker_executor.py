"""Docker-based job execution."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import docker
from docker.errors import DockerException

from runflow_worker.config import get_settings
from runflow_worker.runners.base import BaseRunner, RunContext, RunOutput
from runflow_shared import RunnerType


class DockerExecutor(BaseRunner):
    def __init__(self):
        self._client: docker.DockerClient | None = None
        self._container = None

    def _get_client(self) -> docker.DockerClient:
        if self._client is None:
            self._client = docker.from_env()
        return self._client

    def _runner_image(self, runner_type: str) -> str:
        settings = get_settings()
        if runner_type == RunnerType.BASH:
            return settings.bash_runner_image
        if runner_type == RunnerType.ANSIBLE:
            return settings.ansible_runner_image
        return settings.python_runner_image

    def _build_env(self, ctx: RunContext) -> dict[str, str]:
        env = dict(ctx.env)
        input_dir = Path(ctx.workspace_path) / "input"
        output_dir = Path(ctx.workspace_path) / "output"
        input_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)

        args_file = input_dir / "args.json"
        args_file.write_text(json.dumps(ctx.arguments, ensure_ascii=False), encoding="utf-8")

        env["RUNFLOW_ARGS_FILE"] = "/runflow/input/args.json"
        env["RUNFLOW_RESULT_FILE"] = "/runflow/output/result.json"
        for key, value in ctx.arguments.items():
            if isinstance(value, (str, int, float, bool)):
                env[f"RUNFLOW_ARG_{key.upper()}"] = str(value)

        # Inject secrets as env vars
        for name, value in (ctx.job.get("secrets") or {}).items():
            env[name] = str(value)

        return env

    def _requirements_hash(self, job_files_path: str) -> str | None:
        req = Path(job_files_path) / "requirements.txt"
        if not req.is_file():
            return None
        return hashlib.sha256(req.read_bytes()).hexdigest()[:16]

    def _has_requirements(self, job_files_path: str) -> bool:
        req = Path(job_files_path) / "requirements.txt"
        if not req.is_file():
            return False
        for line in req.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped and not stripped.startswith("#"):
                return True
        return False

    def _env_prefix(self) -> str:
        return "set -a && [ -f /runflow/job/.env ] && . /runflow/job/.env && set +a; "

    def _python_command(self, ctx: RunContext, entrypoint: str) -> list[str]:
        env_load = self._env_prefix()
        job_path = ctx.job["job_files_path"]
        entry = f"/runflow/job/{entrypoint}"
        script = f"{env_load}exec python {entry}"

        if self._has_requirements(job_path):
            req_hash = self._requirements_hash(job_path)
            script = (
                f"{env_load}"
                f"if [ -f /runflow/job/requirements.txt ] && [ -s /runflow/job/requirements.txt ]; then "
                f"  if [ ! -f /cache/venv-{req_hash}/.ready ]; then "
                f"    python -m venv /cache/venv-{req_hash} && "
                f"    /cache/venv-{req_hash}/bin/pip install -q -r /runflow/job/requirements.txt && "
                f"    touch /cache/venv-{req_hash}/.ready; "
                f"  fi && "
                f"  exec /cache/venv-{req_hash}/bin/python {entry}; "
                f"fi; "
                f"exec python {entry}"
            )

        return ["/bin/sh", "-c", script]

    async def prepare(self, ctx: RunContext) -> None:
        import logging

        from runflow_worker.services.job_source import materialize_job_workspace

        log = logging.getLogger(__name__)
        workspace = Path(ctx.workspace_path)
        workspace_job = workspace / "job"
        workspace.mkdir(parents=True, exist_ok=True)

        log.info("Préparation workspace %s", workspace_job)
        await asyncio.to_thread(materialize_job_workspace, ctx.job, workspace_job)
        ctx.job["job_files_path"] = str(workspace_job)
        log.info("Workspace prêt — lancement du runner %s", ctx.job.get("runner_type"))

        for sub in ("input", "output"):
            (workspace / sub).mkdir(parents=True, exist_ok=True)

        ctx.env = self._build_env(ctx)

    async def execute(self, ctx: RunContext) -> RunOutput:
        settings = get_settings()
        if not settings.docker_enabled:
            return await self._execute_local(ctx)

        client = self._get_client()
        job = ctx.job
        workspace = Path(ctx.workspace_path)
        runner_type = job["runner_type"]

        memory_mb = job.get("memory_limit_mb", 512)
        cpu_limit = job.get("cpu_limit", 1.0)
        network_mode = job.get("network_mode", "bridge")
        timeout = job.get("timeout_seconds", 300)
        entrypoint = job.get("entrypoint", "main.py")

        volumes = {
            str(workspace): {"bind": "/runflow", "mode": "rw"},
        }
        cache_dir = Path(settings.pip_cache_dir)
        cache_dir.mkdir(parents=True, exist_ok=True)
        volumes[str(cache_dir)] = {"bind": "/cache", "mode": "rw"}

        if runner_type == RunnerType.BASH:
            command = ["bash", f"/runflow/job/{entrypoint}"]
        elif runner_type == RunnerType.ANSIBLE:
            command = self._ansible_command(ctx)
        else:
            command = self._python_command(ctx, entrypoint)

        try:
            self._container = client.containers.run(
                image=self._runner_image(runner_type),
                command=command,
                volumes=volumes,
                environment=ctx.env,
                detach=True,
                remove=False,
                network_mode=network_mode if network_mode != "none" else "none",
                mem_limit=f"{memory_mb}m",
                nano_cpus=int(cpu_limit * 1e9),
                working_dir="/runflow/job",
            )

            stdout_chunks: list[str] = []
            stderr_chunks: list[str] = []
            log_entries: list[dict] = []

            def _collect_logs():
                assert self._container is not None
                for line in self._container.logs(stream=True, follow=True):
                    text = line.decode("utf-8", errors="replace")
                    if text.endswith("\n"):
                        text = text[:-1]
                    stdout_chunks.append(text + "\n")
                    log_entries.append(
                        {
                            "stream": "stdout",
                            "message": text,
                            "timestamp": datetime.now(UTC).isoformat(),
                        }
                    )

            log_task = asyncio.create_task(asyncio.to_thread(_collect_logs))

            try:
                result = await asyncio.wait_for(
                    asyncio.to_thread(self._container.wait),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                self._container.kill()
                return RunOutput(exit_code=124, stderr="Job timed out", stdout="".join(stdout_chunks))

            await log_task
            exit_code = result.get("StatusCode", 1)
            result_file = workspace / "output" / "result.json"
            result_content = result_file.read_text(encoding="utf-8") if result_file.is_file() else None

            ctx._log_entries = log_entries  # type: ignore[attr-defined]
            return RunOutput(
                exit_code=exit_code,
                stdout="".join(stdout_chunks),
                stderr="".join(stderr_chunks),
                result_file_content=result_content,
            )
        except DockerException as exc:
            return RunOutput(exit_code=1, stderr=str(exc))

    def _ansible_command(self, ctx: RunContext) -> list[str]:
        ansible_cfg = ctx.job.get("ansible_config") or {}
        playbook = ansible_cfg.get("playbook", "playbook.yml")
        inventory = ansible_cfg.get("inventory", "inventory")
        extra_vars_file = "/runflow/input/extra_vars.json"
        extra_vars_path = Path(ctx.workspace_path) / "input" / "extra_vars.json"
        extra_vars_path.parent.mkdir(parents=True, exist_ok=True)
        extra_vars_path.write_text(json.dumps(ctx.arguments), encoding="utf-8")

        # Write SSH key if credential provided
        for cred in ctx.job.get("credentials") or []:
            data = cred.get("data", {})
            if "private_key" in data:
                key_path = Path(ctx.workspace_path) / "input" / "ssh_key"
                key_path.write_text(data["private_key"], encoding="utf-8")
                os.chmod(key_path, 0o600)

        return [
            "ansible-playbook",
            f"/runflow/job/{playbook}",
            "-i", f"/runflow/job/{inventory}",
            "-e", f"@{extra_vars_file}",
        ]

    async def _execute_local(self, ctx: RunContext) -> RunOutput:
        import subprocess

        job = ctx.job
        workspace = Path(ctx.workspace_path) / "job"
        entrypoint = job.get("entrypoint", "main.py")
        env = {**os.environ, **ctx.env}
        env_file = workspace / ".env"
        if env_file.is_file():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                env[key.strip()] = value.strip().strip('"').strip("'")

        if job["runner_type"] == RunnerType.BASH:
            cmd = ["bash", str(workspace / entrypoint)]
        else:
            cmd = ["python3", str(workspace / entrypoint)]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(workspace),
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        result_file = Path(ctx.workspace_path) / "output" / "result.json"
        result_content = result_file.read_text(encoding="utf-8") if result_file.is_file() else None
        return RunOutput(
            exit_code=proc.returncode or 0,
            stdout=stdout.decode(),
            stderr=stderr.decode(),
            result_file_content=result_content,
        )

    async def cleanup(self, ctx: RunContext) -> None:
        if self._container is not None:
            try:
                self._container.remove(force=True)
            except Exception:
                pass
            self._container = None
