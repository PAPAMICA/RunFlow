"""Tests for the ansible-ping inventory connectivity helper."""

import asyncio

from runflow_api.services import inventory_test


def test_empty_inventory_returns_error():
    ok, out = asyncio.run(inventory_test.run_ansible_ping("", None))
    assert ok is False
    assert "vide" in out.lower()


def test_missing_ansible_reports_gracefully(monkeypatch):
    monkeypatch.setattr(inventory_test.shutil, "which", lambda _: None)
    ok, out = asyncio.run(inventory_test.run_ansible_ping("[web]\nhost1", None))
    assert ok is False
    assert "ansible" in out.lower()
