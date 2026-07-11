"""Worker configuration."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        env_prefix="RUNFLOW_",
    )

    api_url: str = "http://localhost:8000"
    worker_token: str = ""
    worker_name: str = "local-worker"
    heartbeat_interval: int = 15
    claim_timeout: int = 25
    python_runner_image: str = "runflow/runner-python:0.1.0"
    bash_runner_image: str = "runflow/runner-bash:0.1.0"
    ansible_runner_image: str = "runflow/runner-ansible:0.1.0"
    docker_enabled: bool = Field(default=True, validation_alias="DOCKER_ENABLED")
    pip_cache_dir: str = "/worker-data/pip-cache"


@lru_cache
def get_settings() -> WorkerSettings:
    return WorkerSettings()
