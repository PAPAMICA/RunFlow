"""Tests for result parsers."""

import pytest

from runflow_api.core.result_parser import ResultParseError, parse_result
from runflow_shared import ResultParser


def test_parse_none():
    assert parse_result(ResultParser.NONE, "", "", 0) is None


def test_parse_json_stdout():
    result = parse_result(ResultParser.JSON_STDOUT, '{"status": "ok"}', "", 0)
    assert result == {"status": "ok"}


def test_parse_last_json_line():
    stdout = "line1\nline2\n{\"value\": 42}\n"
    result = parse_result(ResultParser.LAST_JSON_LINE, stdout, "", 0)
    assert result == {"value": 42}


def test_parse_runflow_sdk():
    result = parse_result(
        ResultParser.RUNFLOW_SDK, "", "", 0, result_file_content='{"domain": "example.com"}'
    )
    assert result == {"domain": "example.com"}


def test_parse_runflow_sdk_invalid():
    with pytest.raises(ResultParseError):
        parse_result(ResultParser.RUNFLOW_SDK, "", "", 0, result_file_content="not json")
