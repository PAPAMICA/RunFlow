"""Tests for run log ingestion."""

from datetime import UTC, datetime

from runflow_api.services.logs import _format_log_timestamp, _parse_log_timestamp


def test_parse_log_timestamp_from_iso_string():
    ts = _parse_log_timestamp("2026-07-11T15:07:29.261638+00:00")
    assert ts.year == 2026
    assert ts.tzinfo is not None


def test_format_log_timestamp_accepts_string():
    assert _format_log_timestamp("2026-07-11T15:07:29+00:00") == "2026-07-11T15:07:29+00:00"


def test_format_log_timestamp_from_datetime():
    ts = datetime(2026, 7, 11, 15, 7, 29, tzinfo=UTC)
    assert "2026-07-11" in _format_log_timestamp(ts)
