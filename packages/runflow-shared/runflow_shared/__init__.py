"""Shared enums and constants for RunFlow."""

from enum import StrEnum


class RunStatus(StrEnum):
    QUEUED = "queued"
    ASSIGNED = "assigned"
    PREPARING = "preparing"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"
    SKIPPED = "skipped"


class RunnerType(StrEnum):
    PYTHON = "python"
    BASH = "bash"
    ANSIBLE = "ansible"
    DOCKER = "docker"
    DOCKER_COMPOSE = "docker_compose"
    COMMAND = "command"
    TERRAFORM = "terraform"
    OPENTOFU = "opentofu"


class SourceType(StrEnum):
    INTERNAL = "internal"
    GIT = "git"


class TriggerType(StrEnum):
    MANUAL = "manual"
    API = "api"
    WEBHOOK = "webhook"
    GIT_PUSH = "git_push"
    SCHEDULE = "schedule"
    EMAIL = "email"
    HTTP_POLL = "http_poll"
    RUN_EVENT = "run_event"
    WORKFLOW = "workflow"


HOOK_TRIGGER_TYPES = frozenset({TriggerType.WEBHOOK, TriggerType.GIT_PUSH})


class LogStream(StrEnum):
    STDOUT = "stdout"
    STDERR = "stderr"
    SYSTEM = "system"
    DEBUG = "debug"


class ResultParser(StrEnum):
    NONE = "none"
    JSON_STDOUT = "json_stdout"
    LAST_JSON_LINE = "last_json_line"
    RUNFLOW_SDK = "runflow_sdk"


class ParameterType(StrEnum):
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    FLAG = "flag"
    SELECT = "select"
    MULTI_SELECT = "multi_select"
    SECRET = "secret"
    JSON = "json"
    FILE = "file"
    DATE = "date"
    DATETIME = "datetime"
    EMAIL = "email"
    URL = "url"
    IP = "ip"
    CIDR = "cidr"
    RAW = "raw"


class UserRole(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    OPERATOR = "operator"
    VIEWER = "viewer"


class WorkerStatus(StrEnum):
    PENDING = "pending"
    ONLINE = "online"
    OFFLINE = "offline"
    BUSY = "busy"


class NetworkMode(StrEnum):
    NONE = "none"
    BRIDGE = "bridge"


# Valid run status transitions
RUN_STATUS_TRANSITIONS: dict[RunStatus, set[RunStatus]] = {
    RunStatus.QUEUED: {RunStatus.ASSIGNED, RunStatus.CANCELLED, RunStatus.SKIPPED},
    RunStatus.ASSIGNED: {RunStatus.PREPARING, RunStatus.CANCELLED, RunStatus.FAILED},
    RunStatus.PREPARING: {RunStatus.RUNNING, RunStatus.FAILED, RunStatus.CANCELLED},
    RunStatus.RUNNING: {RunStatus.SUCCESS, RunStatus.FAILED, RunStatus.TIMEOUT, RunStatus.CANCELLED},
    RunStatus.SUCCESS: set(),
    RunStatus.FAILED: set(),
    RunStatus.TIMEOUT: set(),
    RunStatus.CANCELLED: set(),
    RunStatus.SKIPPED: set(),
}

API_KEY_PREFIX = "rf_live_"
WORKER_TOKEN_PREFIX = "rf_wkr_"
REGISTRATION_TOKEN_PREFIX = "rf_reg_"
