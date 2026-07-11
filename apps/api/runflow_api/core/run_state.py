"""Run state machine."""

from __future__ import annotations

from runflow_shared import RUN_STATUS_TRANSITIONS, RunStatus


class InvalidRunTransitionError(Exception):
    def __init__(self, current: str, target: str):
        super().__init__(f"Invalid run transition: {current} -> {target}")
        self.current = current
        self.target = target


def can_transition(current: str, target: str) -> bool:
    try:
        current_status = RunStatus(current)
        target_status = RunStatus(target)
    except ValueError:
        return False
    return target_status in RUN_STATUS_TRANSITIONS.get(current_status, set())


def validate_transition(current: str, target: str) -> None:
    if not can_transition(current, target):
        raise InvalidRunTransitionError(current, target)


def is_terminal(status: str) -> bool:
    try:
        return len(RUN_STATUS_TRANSITIONS.get(RunStatus(status), set())) == 0
    except ValueError:
        return False
