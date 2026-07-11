"""Pure helpers for the SSH runner and inventory host extraction.

Kept free of Docker/asyncio so they can be unit-tested in isolation.
"""

from __future__ import annotations

import re
import shlex
from typing import Any

_SPLIT_RE = re.compile(r"[,;\s]+")
_PLACEHOLDER_RE = re.compile(r"\{\{\s*(?:args\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")


def parse_inventory_host_specs(content: str) -> list[dict[str, Any]]:
    """Parse an INI-style Ansible inventory into per-host connection specs.

    Honors ``ansible_host``/``ansible_ssh_host``, ``ansible_port``/
    ``ansible_ssh_port`` and ``ansible_user``/``ansible_ssh_user``. Returns dicts
    ``{address, port, user}`` where port/user are ``None`` when not specified.
    Blank lines, comments (``#``/``;``) and ``[group]`` headers are skipped.
    """
    specs: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in (content or "").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith(";") or line.startswith("["):
            continue
        tokens = line.split()
        alias = tokens[0]
        variables: dict[str, str] = {}
        for tok in tokens[1:]:
            if "=" in tok:
                key, _, value = tok.partition("=")
                variables[key.strip()] = value.strip()

        address = variables.get("ansible_host") or variables.get("ansible_ssh_host") or alias
        port_raw = variables.get("ansible_port") or variables.get("ansible_ssh_port")
        user = variables.get("ansible_user") or variables.get("ansible_ssh_user")
        try:
            port = int(port_raw) if port_raw else None
        except ValueError:
            port = None

        if address in seen:
            continue
        seen.add(address)
        specs.append({"address": address, "port": port, "user": user})
    return specs


def extract_hosts_from_inventory(content: str) -> list[str]:
    """Return just the host addresses from an INI-style inventory."""
    return [spec["address"] for spec in parse_inventory_host_specs(content)]


def _split_hosts(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        items: list[str] = []
        for v in value:
            items.extend(_split_hosts(v))
        return items
    return [h for h in _SPLIT_RE.split(str(value).strip()) if h]


def resolve_ssh_hosts(
    ssh_config: dict[str, Any],
    resolved_inventories: list[dict[str, Any]] | None,
    arguments: dict[str, Any],
    *,
    default_user: str = "root",
    default_port: int = 22,
) -> list[dict[str, Any]]:
    """Union of hosts from job config, inventories and a runtime argument.

    Returns a list of ``{address, port, user}`` specs. Per-host inventory
    overrides win; otherwise the job-level defaults apply. De-duplicated by
    address (first occurrence wins).
    """
    specs: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(address: str, port: int | None, user: str | None) -> None:
        if not address or address in seen:
            return
        seen.add(address)
        specs.append(
            {
                "address": address,
                "port": port or default_port,
                "user": user or default_user,
            }
        )

    for h in _split_hosts(ssh_config.get("hosts")):
        add(h, None, None)

    for inv in resolved_inventories or []:
        for spec in parse_inventory_host_specs(inv.get("content", "")):
            add(spec["address"], spec.get("port"), spec.get("user"))

    arg_name = ssh_config.get("hosts_argument")
    if arg_name and arg_name in arguments:
        for h in _split_hosts(arguments.get(arg_name)):
            add(h, None, None)

    return specs


def render_remote_command(command: str, arguments: dict[str, Any]) -> str:
    """Replace ``{{ name }}`` / ``{{ args.name }}`` with shell-quoted values."""

    def repl(match: re.Match[str]) -> str:
        key = match.group(1)
        if key in arguments:
            return shlex.quote(str(arguments[key]))
        return ""

    return _PLACEHOLDER_RE.sub(repl, command or "")


def build_ssh_script(
    *,
    hosts: list[dict[str, Any]],
    command_file: str,
    key_file: str | None,
    use_password: bool,
    become: bool,
) -> str:
    """Build a POSIX shell script that runs ``command_file`` on each host.

    ``hosts`` is a list of ``{address, port, user}`` specs (per-host user/port).
    Output is prefixed with ``[host]`` per line and the overall exit code is
    non-zero if any host fails.
    """
    ssh_opts = (
        "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10"
    )
    if key_file:
        ssh_opts += f" -i {shlex.quote(key_file)}"

    ssh_bin = "sshpass -e ssh" if use_password else "ssh"
    remote_shell = "sudo -H bash -s" if become else "bash -s"
    cmd_q = shlex.quote(command_file)

    lines = [
        "set -u",
        'RF_OUT="${TMPDIR:-/tmp}/rf_ssh_out"',
        "overall=0",
        "run_host() {",
        '  RF_U="$1"; RF_P="$2"; RF_H="$3"',
        '  echo "== $RF_H =="',
        f'  if {ssh_bin} {ssh_opts} -p "$RF_P" "$RF_U@$RF_H" {remote_shell} < {cmd_q}'
        ' > "$RF_OUT" 2>&1; then rc=0; else rc=$?; fi',
        '  awk -v h="$RF_H" \'{print "["h"] "$0}\' "$RF_OUT"',
        '  if [ "$rc" -ne 0 ]; then overall=1; echo "[$RF_H] exit=$rc"; fi',
        "}",
    ]
    for spec in hosts:
        user = shlex.quote(str(spec.get("user") or "root"))
        port = shlex.quote(str(spec.get("port") or 22))
        address = shlex.quote(str(spec.get("address")))
        lines.append(f"run_host {user} {port} {address}")
    lines.append("exit $overall")
    return "\n".join(lines) + "\n"


def pick_ssh_credential(credentials: list[dict[str, Any]] | None) -> dict[str, Any] | None:
    """Return the first credential exposing SSH auth material."""
    for cred in credentials or []:
        data = cred.get("data") or {}
        if data.get("private_key") or data.get("password"):
            return data
    return None
