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
from runflow_worker.debug_log import emit_post_run_debug, emit_runner_debug, emit_workspace_debug
from runflow_worker.docker_paths import resolve_docker_bind_path, self_container_id
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

        root = ctx.container_root
        env["RUNFLOW_ARGS_FILE"] = f"{root}/input/args.json"
        env["RUNFLOW_RESULT_FILE"] = f"{root}/output/result.json"
        if ctx.debug:
            env["RUNFLOW_DEBUG"] = "1"
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

    def _env_prefix(self, ctx: RunContext) -> str:
        root = ctx.container_root
        return f"set -a && [ -f {root}/job/.env ] && . {root}/job/.env && set +a; "

    def _python_command(self, ctx: RunContext, entrypoint: str) -> list[str]:
        env_load = self._env_prefix(ctx)
        job_path = ctx.job["job_files_path"]
        root = ctx.container_root
        cache = ctx.cache_root
        entry = f"{root}/job/{entrypoint}"
        script = f"{env_load}exec python {entry}"

        if self._has_requirements(job_path):
            req_hash = self._requirements_hash(job_path)
            script = (
                f"{env_load}"
                f"if [ -f {root}/job/requirements.txt ] && [ -s {root}/job/requirements.txt ]; then "
                f"  if [ ! -f {cache}/venv-{req_hash}/.ready ]; then "
                f"    python -m venv {cache}/venv-{req_hash} && "
                f"    {cache}/venv-{req_hash}/bin/pip install -q -r {root}/job/requirements.txt && "
                f"    touch {cache}/venv-{req_hash}/.ready; "
                f"  fi && "
                f"  exec {cache}/venv-{req_hash}/bin/python {entry}; "
                f"fi; "
                f"exec python {entry}"
            )

        return ["/bin/sh", "-c", script]

    def _docker_volume_path(self, container_path: str) -> str:
        settings = get_settings()
        return resolve_docker_bind_path(
            container_path,
            worker_data_dir=settings.worker_data_dir,
            host_data_dir=settings.host_data_dir,
        )

    def _plan_runtime(self, ctx: RunContext) -> None:
        """Decide how the runner container will access the workspace.

        When the worker itself runs inside Docker, we share its volumes with the
        runner via ``volumes_from`` so files are visible at the exact same paths —
        no fragile host-path translation needed. Otherwise we bind-mount.
        """
        settings = get_settings()
        container_id = self_container_id() if settings.docker_enabled else None
        if container_id:
            ctx.volumes_from = container_id
            ctx.container_root = str(Path(ctx.workspace_path))
            ctx.cache_root = str(Path(settings.pip_cache_dir))
        else:
            ctx.volumes_from = None
            ctx.container_root = "/runflow"
            ctx.cache_root = "/cache"

    async def prepare(self, ctx: RunContext) -> None:
        import logging

        from runflow_worker.services.job_source import materialize_job_workspace

        log = logging.getLogger(__name__)
        workspace = Path(ctx.workspace_path)
        workspace_job = workspace / "job"
        workspace.mkdir(parents=True, exist_ok=True)

        log.info("Préparation workspace %s", workspace_job)
        await asyncio.to_thread(
            materialize_job_workspace,
            ctx.job,
            workspace_job,
            on_system_log=ctx.on_system_log,
            on_debug_log=ctx.on_debug_log,
            debug=ctx.debug,
        )
        ctx.job["job_files_path"] = str(workspace_job)
        for sub in ("input", "output"):
            (workspace / sub).mkdir(parents=True, exist_ok=True)

        self._plan_runtime(ctx)
        ctx.env = self._build_env(ctx)

        if ctx.debug:
            await asyncio.to_thread(
                emit_workspace_debug,
                workspace,
                ctx.job,
                ctx.arguments,
                on_log=ctx.on_debug_log,
            )

        if ctx.on_system_log:
            ctx.on_system_log(
                f"Lancement du runner {ctx.job.get('runner_type')} — {ctx.job.get('resolved_entrypoint', ctx.job.get('entrypoint'))}"
            )

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
        entrypoint = job.get("resolved_entrypoint") or job.get("entrypoint", "main.py")

        cache_dir = Path(settings.pip_cache_dir)
        cache_dir.mkdir(parents=True, exist_ok=True)

        run_kwargs: dict[str, Any] = {}
        volumes: dict[str, dict[str, str]] = {}
        if ctx.volumes_from:
            # Runner inherits the worker's mounts; files share the same paths.
            run_kwargs["volumes_from"] = [ctx.volumes_from]
        else:
            volumes = {
                self._docker_volume_path(str(workspace)): {"bind": "/runflow", "mode": "rw"},
                self._docker_volume_path(str(cache_dir)): {"bind": "/cache", "mode": "rw"},
            }
            run_kwargs["volumes"] = volumes

        if ctx.debug and ctx.on_debug_log:
            entry_container = workspace / "job" / entrypoint
            if ctx.volumes_from:
                ctx.on_debug_log(f"Partage des volumes du worker (volumes_from={ctx.volumes_from[:12]})")
                ctx.on_debug_log(f"Racine runner : {ctx.container_root}")
            else:
                ctx.on_debug_log(f"Volume workspace (hôte Docker) : {self._docker_volume_path(str(workspace))}")
                ctx.on_debug_log(f"Volume pip-cache (hôte Docker) : {self._docker_volume_path(str(cache_dir))}")
            ctx.on_debug_log(
                f"Entrypoint worker : {'présent' if entry_container.is_file() else 'ABSENT'} ({entry_container})"
            )

        if runner_type == RunnerType.BASH:
            command = ["bash", f"{ctx.container_root}/job/{entrypoint}"]
        elif runner_type == RunnerType.ANSIBLE:
            command = self._ansible_command(ctx)
        else:
            command = self._python_command(ctx, entrypoint)

        image = self._runner_image(runner_type)
        if ctx.debug:
            secret_keys = set((ctx.job.get("secrets") or {}).keys())
            await asyncio.to_thread(
                emit_runner_debug,
                runner_type=runner_type,
                image=image,
                command=command,
                volumes=volumes or {f"(volumes_from {ctx.volumes_from})": {"bind": ctx.container_root, "mode": "rw"}},
                env=ctx.env,
                secret_keys=secret_keys,
                on_log=ctx.on_debug_log,
            )

        try:
            self._container = client.containers.run(
                image=image,
                command=command,
                environment=ctx.env,
                detach=True,
                remove=False,
                network_mode=network_mode if network_mode != "none" else "none",
                mem_limit=f"{memory_mb}m",
                nano_cpus=int(cpu_limit * 1e9),
                working_dir=f"{ctx.container_root}/job",
                **run_kwargs,
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
                    entry = {
                        "stream": "stdout",
                        "message": text,
                        "timestamp": datetime.now(UTC).isoformat(),
                    }
                    log_entries.append(entry)
                    if ctx.debug and ctx.on_stream_log:
                        ctx.on_stream_log("stdout", text)

            log_task = asyncio.create_task(asyncio.to_thread(_collect_logs))

            try:
                result = await asyncio.wait_for(
                    asyncio.to_thread(self._container.wait),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                self._container.kill()
                log_task.cancel()
                try:
                    await log_task
                except (asyncio.CancelledError, Exception):
                    pass
                output = RunOutput(exit_code=124, stderr="Job timed out", stdout="".join(stdout_chunks))
                if ctx.debug:
                    await asyncio.to_thread(
                        emit_post_run_debug,
                        workspace,
                        output.exit_code,
                        output.stdout,
                        output.stderr,
                        on_log=ctx.on_debug_log,
                    )
                return output

            await log_task
            exit_code = result.get("StatusCode", 1)
            result_file = workspace / "output" / "result.json"
            result_content = result_file.read_text(encoding="utf-8") if result_file.is_file() else None

            output = RunOutput(
                exit_code=exit_code,
                stdout="".join(stdout_chunks),
                stderr="".join(stderr_chunks),
                result_file_content=result_content,
            )
            if ctx.debug:
                await asyncio.to_thread(
                    emit_post_run_debug,
                    workspace,
                    output.exit_code,
                    output.stdout,
                    output.stderr,
                    on_log=ctx.on_debug_log,
                )
            else:
                ctx._log_entries = log_entries  # type: ignore[attr-defined]
            return output
        except DockerException as exc:
            return RunOutput(exit_code=1, stderr=str(exc))

    def _ansible_command(self, ctx: RunContext) -> list[str]:
        ansible_cfg = ctx.job.get("ansible_config") or {}
        playbook = ansible_cfg.get("playbook", "playbook.yml")
        inventory = ansible_cfg.get("inventory", "inventory")
        root = ctx.container_root
        extra_vars_file = f"{root}/input/extra_vars.json"
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
            f"{root}/job/{playbook}",
            "-i", f"{root}/job/{inventory}",
            "-e", f"@{extra_vars_file}",
        ]

    async def _execute_local(self, ctx: RunContext) -> RunOutput:
        import subprocess

        job = ctx.job
        workspace = Path(ctx.workspace_path) / "job"
        entrypoint = job.get("resolved_entrypoint") or job.get("entrypoint", "main.py")
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

        if ctx.debug and ctx.on_debug_log:
            import shlex
            ctx.on_debug_log("── Exécution locale (docker désactivé) ──")
            ctx.on_debug_log(f"  commande: {' '.join(shlex.quote(c) for c in cmd)}")
            ctx.on_debug_log(f"  cwd: {workspace}")

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(workspace),
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        stdout_text = stdout.decode()
        stderr_text = stderr.decode()

        if ctx.debug and ctx.on_stream_log:
            for line in stdout_text.splitlines():
                ctx.on_stream_log("stdout", line)
            for line in stderr_text.splitlines():
                ctx.on_stream_log("stderr", line)

        result_file = Path(ctx.workspace_path) / "output" / "result.json"
        result_content = result_file.read_text(encoding="utf-8") if result_file.is_file() else None
        output = RunOutput(
            exit_code=proc.returncode or 0,
            stdout=stdout_text,
            stderr=stderr_text,
            result_file_content=result_content,
        )
        if ctx.debug:
            await asyncio.to_thread(
                emit_post_run_debug,
                Path(ctx.workspace_path),
                output.exit_code,
                output.stdout,
                output.stderr,
                on_log=ctx.on_debug_log,
            )
        return output

    async def cleanup(self, ctx: RunContext) -> None:
        if self._container is not None:
            try:
                self._container.remove(force=True)
            except Exception:
                pass
            self._container = None
