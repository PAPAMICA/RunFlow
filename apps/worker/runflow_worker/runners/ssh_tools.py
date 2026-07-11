"""Pure helpers for the SSH runner and inventory host extraction.

Kept free of Docker/asyncio so they can be unit-tested in isolation.
"""

from __future__ import annotations

import re
import shlex
from typing import Any

_SPLIT_RE = re.compile(r"[,;\s]+")
_PLACEHOLDER_RE = re.compile(r"\{\{\s*(?:args\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")


def extract_hosts_from_inventory(content: str) -> list[str]:
    """Extract host names from an INI-style Ansible inventory.

    Skips blank lines, comments and ``[group]`` headers. For each host line the
    first token is the alias; an ``ansible_host=<addr>`` override is honored.
    """
    hosts: list[str] = []
    for raw in (content or "").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith(";"):
            continue
        if line.startswith("["):
            continue
        tokens = line.split()
        host = tokens[0]
        for tok in tokens[1:]:
            if tok.startswith("ansible_host="):
                host = tok.split("=", 1)[1]
                break
        if host and host not in hosts:
            hosts.append(host)
    return hosts


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
) -> list[str]:
    """Union of hosts from the job config, inventories and a runtime argument."""
    hosts: list[str] = []

    for h in _split_hosts(ssh_config.get("hosts")):
        if h not in hosts:
            hosts.append(h)

    for inv in resolved_inventories or []:
        for h in extract_hosts_from_inventory(inv.get("content", "")):
            if h not in hosts:
                hosts.append(h)

    arg_name = ssh_config.get("hosts_argument")
    if arg_name and arg_name in arguments:
        for h in _split_hosts(arguments.get(arg_name)):
            if h not in hosts:
                hosts.append(h)

    return hosts


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
    hosts: list[str],
    user: str,
    port: int,
    command_file: str,
    key_file: str | None,
    use_password: bool,
    become: bool,
) -> str:
    """Build a POSIX shell script that runs ``command_file`` on each host.

    Output is prefixed with ``[host]`` per line and the overall exit code is
    non-zero if any host fails.
    """
    ssh_opts = (
        "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "
        f"-o ConnectTimeout=10 -p {int(port)}"
    )
    if key_file:
        ssh_opts += f" -i {shlex.quote(key_file)}"

    ssh_bin = "sshpass -e ssh" if use_password else "ssh"
    remote_shell = "sudo -H bash -s" if become else "bash -s"
    user_q = shlex.quote(user or "root")
    cmd_q = shlex.quote(command_file)

    host_list = " ".join(shlex.quote(h) for h in hosts)

    # POSIX sh (dash): capture output to a temp file so the ssh exit code is not
    # masked by the awk prefixer in a pipeline.
    return (
        "set -u\n"
        'RF_OUT="${TMPDIR:-/tmp}/rf_ssh_out"\n'
        "overall=0\n"
        f"for H in {host_list}; do\n"
        '  echo "== $H =="\n'
        f'  if {ssh_bin} {ssh_opts} {user_q}@"$H" {remote_shell} < {cmd_q} > "$RF_OUT" 2>&1; '
        "then rc=0; else rc=$?; fi\n"
        '  awk -v h="$H" \'{print "["h"] "$0}\' "$RF_OUT"\n'
        '  if [ "$rc" -ne 0 ]; then overall=1; echo "[$H] exit=$rc"; fi\n'
        "done\n"
        "exit $overall\n"
    )


def pick_ssh_credential(credentials: list[dict[str, Any]] | None) -> dict[str, Any] | None:
    """Return the first credential exposing SSH auth material."""
    for cred in credentials or []:
        data = cred.get("data") or {}
        if data.get("private_key") or data.get("password"):
            return data
    return None
