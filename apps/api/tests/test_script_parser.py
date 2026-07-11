"""Tests for script argument extraction."""

from runflow_api.services.script_parser import parse_bash_script, parse_python_script


def test_parse_python_argparse():
    source = '''
import argparse
parser = argparse.ArgumentParser()
parser.add_argument("--domain", required=True, help="Target domain")
parser.add_argument("-v", "--verbose", action="store_true")
parser.add_argument("--env", choices=["prod", "dev"], default="dev")
'''
    params = parse_python_script(source)
    names = {p["name"] for p in params}
    assert "domain" in names
    assert "verbose" in names
    assert "env" in names
    env = next(p for p in params if p["name"] == "env")
    assert env["param_type"] == "select"
    assert env["options"] == ["prod", "dev"]
    verbose = next(p for p in params if p["name"] == "verbose")
    assert verbose["param_type"] == "flag"


def test_parse_bash_usage_and_positional():
    source = '''#!/bin/bash
# Usage: deploy.sh <domain> [port]
HOST="${1:-localhost}"
PORT="${2:-8080}"
echo "$HOST"
'''
    params = parse_bash_script(source)
    names = {p["name"] for p in params}
    assert "domain" in names
    assert "HOST" in names or "arg_1" in names
