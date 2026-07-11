"""Schema validation tests for Ansible/SSH runner job configuration."""

import pytest
from pydantic import ValidationError

from runflow_api.schemas import AnsibleConfig, JobCreate, JobUpdate, SshConfig


def test_ansible_config_defaults():
    cfg = AnsibleConfig()
    assert cfg.playbook == "playbook.yml"
    assert cfg.inventory_source == "internal"
    assert cfg.tags == []
    assert cfg.become is False


def test_ansible_config_invalid_inventory_source():
    with pytest.raises(ValidationError):
        AnsibleConfig(inventory_source="ftp")


def test_ssh_config_defaults():
    cfg = SshConfig()
    assert cfg.user == "root"
    assert cfg.port == 22
    assert cfg.hosts == []
    assert cfg.hosts_argument is None


def test_job_create_accepts_ansible_config():
    job = JobCreate(
        project_id="p1",
        name="Deploy",
        slug="deploy",
        runner_type="ansible",
        ansible_config={
            "playbook": "site.yml",
            "tags": ["deploy"],
            "become": True,
        },
        credential_refs=["c1"],
    )
    assert job.ansible_config.playbook == "site.yml"
    assert job.ansible_config.tags == ["deploy"]
    assert job.credential_refs == ["c1"]


def test_job_create_accepts_ssh_config():
    job = JobCreate(
        project_id="p1",
        name="Ops",
        slug="ops",
        runner_type="ssh",
        ssh_config={"hosts": ["h1", "h2"], "command": "uptime", "user": "deploy"},
    )
    assert job.ssh_config.hosts == ["h1", "h2"]
    assert job.ssh_config.user == "deploy"


def test_job_update_partial_ssh_config():
    upd = JobUpdate(ssh_config={"command": "df -h"})
    assert upd.ssh_config.command == "df -h"
    assert upd.ansible_config is None
