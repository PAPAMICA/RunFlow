"""Application configuration."""

from functools import lru_cache
from typing import Self
from urllib.parse import quote_plus

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "RunFlow"
    app_version: str = "0.1.0"
    debug: bool = False

    database_url: str = "postgresql+asyncpg://runflow:runflow@localhost:5432/runflow"
    postgres_host: str = ""
    postgres_port: int = 5432
    postgres_user: str = "runflow"
    postgres_password: str = ""
    postgres_db: str = "runflow"
    valkey_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    runflow_master_key: str = ""
    data_dir: str = "/data"
    jobs_dir: str = "/data/jobs"
    runs_dir: str = "/data/runs"

    cors_origins: str = "http://localhost:3000"
    runflow_web_host: str = ""

    reconciliation_interval_seconds: int = 30
    worker_offline_threshold_seconds: int = 60

    @model_validator(mode="after")
    def assemble_database_url(self) -> Self:
        if self.postgres_host and self.postgres_password:
            password = quote_plus(self.postgres_password)
            url = (
                f"postgresql+asyncpg://{self.postgres_user}:{password}"
                f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
            )
            object.__setattr__(self, "database_url", url)
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        origins: list[str] = []
        for raw in self.cors_origins.split(","):
            origin = raw.strip().rstrip("/")
            if origin:
                origins.append(origin)
        if self.runflow_web_host:
            host = self.runflow_web_host.strip()
            for origin in (f"https://{host}", f"http://{host}"):
                if origin not in origins:
                    origins.append(origin)
        return origins or ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
