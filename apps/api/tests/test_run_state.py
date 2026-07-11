"""Tests for run state machine."""

import pytest

from runflow_api.core.run_state import (
    InvalidRunTransitionError,
    can_transition,
    is_terminal,
    validate_transition,
)
from runflow_shared import RunStatus


def test_valid_transitions():
    assert can_transition(RunStatus.QUEUED, RunStatus.ASSIGNED)
    assert can_transition(RunStatus.ASSIGNED, RunStatus.PREPARING)
    assert can_transition(RunStatus.RUNNING, RunStatus.SUCCESS)
    assert not can_transition(RunStatus.SUCCESS, RunStatus.RUNNING)
    assert not can_transition(RunStatus.QUEUED, RunStatus.SUCCESS)


def test_validate_transition_raises():
    with pytest.raises(InvalidRunTransitionError):
        validate_transition(RunStatus.SUCCESS, RunStatus.RUNNING)


def test_is_terminal():
    assert is_terminal(RunStatus.SUCCESS)
    assert is_terminal(RunStatus.FAILED)
    assert not is_terminal(RunStatus.RUNNING)
