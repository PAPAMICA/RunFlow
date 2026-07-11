"""Tests for Ansible and SSH command construction in the Docker executor."""

from pathlib import Path

from runflow_worker.runners.base import RunContext
from runflow_worker.runners.docker_executor import DockerExecutor


def _ctx(tmp_path: Path, job: dict, arguments: dict | None = None) -> RunContext:
    return RunContext(
        run_id="run1",
        job=job,
        arguments=arguments or {},
        workspace_path=str(tmp_path),
        env={},
    )


def test_ansible_command_full(tmp_path):
    job = {
        "runner_type": "ansible",
        "ansible_config": {
            "playbook": "site.yml",
            "inventory_source": "internal",
            "inventory_content": "[web]\nh1.example.com\n",
            "tags": ["deploy", "config"],
            "skip_tags": ["slow"],
            "limit": "web",
            "become": True,
            "extra_vars": {"env": "prod"},
        },
        "credentials": [{"data": {"private_key": "KEY"}}],
    }
    ctx = _ctx(tmp_path, job, {"version": "1.2"})
    cmd = DockerExecutor()._ansible_command(ctx, "/runflow")

    assert cmd[0] == "ansible-playbook"
    assert "/runflow/job/site.yml" in cmd
    assert cmd[cmd.index("-i") + 1] == "/runflow/input/inventory"
    assert cmd[cmd.index("--tags") + 1] == "deploy,config"
    assert cmd[cmd.index("--skip-tags") + 1] == "slow"
    assert cmd[cmd.index("--limit") + 1] == "web"
    assert "--become" in cmd

    inv = (tmp_path / "input" / "inventory").read_text()
    assert "h1.example.com" in inv
    extra = (tmp_path / "input" / "extra_vars.json").read_text()
    assert '"env": "prod"' in extra
    assert '"version": "1.2"' in extra

    assert ctx.env["ANSIBLE_HOST_KEY_CHECKING"] == "False"
    assert ctx.env["ANSIBLE_PRIVATE_KEY_FILE"] == "/runflow/input/ssh_key"
    assert (tmp_path / "input" / "ssh_key").read_text().startswith("KEY")


def test_ansible_command_minimal_uses_job_inventory(tmp_path):
    job = {"runner_type": "ansible", "ansible_config": {"playbook": "p.yml"}, "credentials": []}
    ctx = _ctx(tmp_path, job)
    cmd = DockerExecutor()._ansible_command(ctx, "/runflow")
    assert cmd[cmd.index("-i") + 1] == "/runflow/job/inventory"
    assert "--become" not in cmd


def test_ssh_command_key_auth(tmp_path):
    job = {
        "runner_type": "ssh",
        "ssh_config": {
            "hosts": ["h1", "h2"],
            "user": "deploy",
            "port": 2222,
            "command": "echo {{ msg }}",
        },
        "credentials": [{"data": {"private_key": "PRIV"}}],
    }
    ctx = _ctx(tmp_path, job, {"msg": "hi there"})
    cmd = DockerExecutor()._ssh_command(ctx, "/runflow")

    assert cmd[0] == "/bin/sh"
    assert cmd[1] == "-c"
    script = cmd[2]
    assert "for H in h1 h2; do" in script
    assert "-i /runflow/input/ssh_key" in script
    assert "-p 2222" in script
    assert "deploy@" in script
    assert "sshpass" not in script

    remote = (tmp_path / "input" / "ssh_command.sh").read_text()
    assert remote.strip() == "echo 'hi there'"
    assert (tmp_path / "input" / "ssh_key").read_text().startswith("PRIV")


def test_ssh_command_password_auth(tmp_path):
    job = {
        "runner_type": "ssh",
        "ssh_config": {"hosts": ["h1"], "command": "uptime", "become": True},
        "credentials": [{"data": {"username": "root", "password": "s3cret"}}],
    }
    ctx = _ctx(tmp_path, job)
    cmd = DockerExecutor()._ssh_command(ctx, "/runflow")
    script = cmd[2]
    assert "sshpass -e ssh" in script
    assert "sudo -H bash -s" in script
    assert ctx.env["SSHPASS"] == "s3cret"


def test_ssh_command_no_hosts(tmp_path):
    job = {"runner_type": "ssh", "ssh_config": {"command": "uptime"}, "credentials": []}
    ctx = _ctx(tmp_path, job)
    cmd = DockerExecutor()._ssh_command(ctx, "/runflow")
    assert "Aucun hôte SSH résolu" in cmd[2]
