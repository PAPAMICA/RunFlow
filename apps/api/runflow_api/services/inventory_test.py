"""Run an ad-hoc ``ansible ping`` against an inventory for connectivity testing."""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any


async def run_ansible_ping(
    content: str,
    credential_data: dict[str, Any] | None,
    *,
    timeout: float = 60.0,
) -> tuple[bool, str]:
    """Execute ``ansible all -i <inventory> -m ping``.

    Returns ``(success, combined_output)``. Uses the SSH credential (private key
    or username/password) when provided. Never raises for connectivity failures;
    only unexpected setup issues surface as an error string.
    """
    if not (content or "").strip():
        return False, "Inventaire vide."

    if shutil.which("ansible") is None:
        return False, "ansible n'est pas installé sur le serveur API."

    workdir = Path(tempfile.mkdtemp(prefix="rf-invtest-"))
    try:
        inventory = workdir / "inventory"
        inventory.write_text(content, encoding="utf-8")

        env = {
            **os.environ,
            "ANSIBLE_HOST_KEY_CHECKING": "False",
            "ANSIBLE_RETRY_FILES_ENABLED": "False",
            "ANSIBLE_NOCOLOR": "1",
        }

        cmd = ["ansible", "all", "-i", str(inventory), "-m", "ping"]

        data = credential_data or {}
        user = data.get("username")
        if user:
            cmd += ["-u", str(user)]

        private_key = data.get("private_key")
        password = data.get("password")
        if private_key:
            key_file = workdir / "ssh_key"
            content_key = private_key if private_key.endswith("\n") else private_key + "\n"
            key_file.write_text(content_key, encoding="utf-8")
            os.chmod(key_file, 0o600)
            cmd += ["--private-key", str(key_file)]
            if data.get("passphrase"):
                # Passphrase-protected keys require ssh-agent; surface a hint later
                # if the connection fails. We still pass the key file.
                pass
        elif password:
            # Password auth needs sshpass (installed in the image). Pass the
            # password via an extra-vars file to keep it out of the process list.
            extra = workdir / "extra_vars.json"
            extra.write_text(
                json.dumps({"ansible_password": password, "ansible_connection": "ssh"}),
                encoding="utf-8",
            )
            cmd += ["-e", f"@{extra}"]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                env=env,
                cwd=str(workdir),
            )
        except FileNotFoundError:
            return False, "ansible n'est pas installé sur le serveur API."

        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            return False, f"Délai dépassé ({int(timeout)}s)."

        output = (stdout or b"").decode(errors="replace").strip()
        return proc.returncode == 0, output or "(aucune sortie)"
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
