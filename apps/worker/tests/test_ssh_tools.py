"""Tests for SSH runner helpers (host resolution + script generation)."""

from runflow_worker.runners.ssh_tools import (
    build_ssh_script,
    extract_hosts_from_inventory,
    pick_ssh_credential,
    render_remote_command,
    resolve_ssh_hosts,
)


def test_extract_hosts_skips_comments_and_groups():
    inv = """
# a comment
[web]
server1.example.com
server2.example.com ansible_host=10.0.0.2

; another comment
[db]
db1.example.com
"""
    hosts = extract_hosts_from_inventory(inv)
    assert hosts == ["server1.example.com", "10.0.0.2", "db1.example.com"]


def test_resolve_ssh_hosts_union_dedup():
    ssh_cfg = {"hosts": ["a.example.com", "b.example.com"], "hosts_argument": "targets"}
    inventories = [{"content": "b.example.com\nc.example.com"}]
    args = {"targets": "c.example.com, d.example.com"}
    hosts = resolve_ssh_hosts(ssh_cfg, inventories, args)
    assert hosts == ["a.example.com", "b.example.com", "c.example.com", "d.example.com"]


def test_resolve_ssh_hosts_no_argument():
    hosts = resolve_ssh_hosts({"hosts": ["a"]}, None, {})
    assert hosts == ["a"]


def test_render_remote_command_shell_quotes():
    rendered = render_remote_command("echo {{ msg }}", {"msg": "hello world; rm -rf /"})
    assert rendered == "echo 'hello world; rm -rf /'"


def test_render_remote_command_supports_args_prefix_and_missing():
    rendered = render_remote_command("run {{ args.name }} {{ absent }}", {"name": "x"})
    assert rendered == "run x "


def test_build_ssh_script_key_auth():
    script = build_ssh_script(
        hosts=["h1", "h2"],
        user="deploy",
        port=2222,
        command_file="/runflow/input/ssh_command.sh",
        key_file="/runflow/input/ssh_key",
        use_password=False,
        become=False,
    )
    assert "for H in h1 h2; do" in script
    assert "-p 2222" in script
    assert "-i /runflow/input/ssh_key" in script
    assert "deploy@" in script
    assert "bash -s" in script
    assert "sshpass" not in script
    assert "exit $overall" in script


def test_build_ssh_script_password_and_become():
    script = build_ssh_script(
        hosts=["h1"],
        user="root",
        port=22,
        command_file="/c/cmd.sh",
        key_file=None,
        use_password=True,
        become=True,
    )
    assert "sshpass -e ssh" in script
    assert "sudo -H bash -s" in script


def test_pick_ssh_credential():
    creds = [
        {"data": {"foo": "bar"}},
        {"data": {"private_key": "KEY"}},
    ]
    assert pick_ssh_credential(creds) == {"private_key": "KEY"}
    assert pick_ssh_credential([]) is None
    assert pick_ssh_credential([{"data": {"password": "p"}}]) == {"password": "p"}
