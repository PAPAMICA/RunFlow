"""Central authorization system."""

from __future__ import annotations

from dataclasses import dataclass

from runflow_shared import UserRole

ROLE_PERMISSIONS: dict[str, set[str]] = {
    UserRole.OWNER: {
        "org:read",
        "org:write",
        "project:read",
        "project:write",
        "job:read",
        "job:write",
        "job:run",
        "run:read",
        "worker:read",
        "worker:write",
        "apikey:read",
        "apikey:write",
        "workflow:read",
        "workflow:run",
        "admin",
    },
    UserRole.ADMIN: {
        "org:read",
        "project:read",
        "project:write",
        "job:read",
        "job:write",
        "job:run",
        "run:read",
        "worker:read",
        "worker:write",
        "apikey:read",
        "apikey:write",
        "workflow:read",
        "workflow:run",
    },
    UserRole.OPERATOR: {
        "org:read",
        "project:read",
        "job:read",
        "job:write",
        "job:run",
        "run:read",
        "worker:read",
        "workflow:read",
        "workflow:run",
    },
    UserRole.VIEWER: {
        "org:read",
        "project:read",
        "job:read",
        "run:read",
        "worker:read",
        "workflow:read",
    },
}

API_SCOPE_PERMISSIONS: dict[str, set[str]] = {
    "job:read": {"job:read"},
    "job:run": {"job:run", "job:read", "run:read"},
    "run:read": {"run:read"},
    "workflow:read": {"workflow:read"},
    "workflow:run": {"workflow:run", "workflow:read"},
    "admin": {"admin"},
}


@dataclass
class AuthContext:
    user_id: str | None = None
    organization_id: str | None = None
    role: str | None = None
    api_key_id: str | None = None
    scopes: list[str] | None = None
    project_id: str | None = None
    allowed_job_ids: list[str] | None = None

    def has_permission(self, permission: str) -> bool:
        if self.api_key_id and self.scopes:
            if "admin" in self.scopes:
                return True
            allowed = set()
            for scope in self.scopes:
                allowed.update(API_SCOPE_PERMISSIONS.get(scope, {scope}))
            return permission in allowed
        if self.role:
            return permission in ROLE_PERMISSIONS.get(self.role, set())
        return False

    def can_run_job(self, job_id: str, project_id: str) -> bool:
        if self.api_key_id:
            if self.project_id and self.project_id != project_id:
                return False
            if self.allowed_job_ids and job_id not in self.allowed_job_ids:
                return False
            return self.has_permission("job:run")
        return self.has_permission("job:run")
