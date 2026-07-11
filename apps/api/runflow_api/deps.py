"""FastAPI dependencies for authentication."""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from runflow_api.core.authorization import AuthContext
from runflow_api.core.security import decode_access_token, verify_api_key_hash, verify_worker_token_hash
from runflow_api.db import get_db
from runflow_api.models import APIKey, OrganizationMember, User, Worker
from runflow_shared import API_KEY_PREFIX, WORKER_TOKEN_PREFIX

bearer_scheme = HTTPBearer(auto_error=False)


async def get_auth_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    session: AsyncSession = Depends(get_db),
) -> AuthContext:
    if x_api_key:
        if not x_api_key.startswith(API_KEY_PREFIX):
            raise HTTPException(status_code=401, detail="Invalid API key format")
        prefix = x_api_key[:16]
        result = await session.execute(
            select(APIKey).where(APIKey.prefix == prefix, APIKey.enabled.is_(True))
        )
        api_key = result.scalar_one_or_none()
        if not api_key or not verify_api_key_hash(x_api_key, api_key.key_hash):
            raise HTTPException(status_code=401, detail="Invalid API key")
        return AuthContext(
            api_key_id=api_key.id,
            organization_id=api_key.organization_id,
            scopes=api_key.scopes or [],
            project_id=api_key.project_id,
            allowed_job_ids=api_key.allowed_job_ids,
        )

    if credentials and credentials.scheme.lower() == "bearer":
        payload = decode_access_token(credentials.credentials)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = payload.get("sub")
        org_id = payload.get("org_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        user_result = await session.execute(select(User).where(User.id == user_id, User.enabled.is_(True)))
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        role = None
        if org_id:
            member_result = await session.execute(
                select(OrganizationMember).where(
                    OrganizationMember.user_id == user_id,
                    OrganizationMember.organization_id == org_id,
                )
            )
            member = member_result.scalar_one_or_none()
            role = member.role if member else None

        return AuthContext(user_id=user_id, organization_id=org_id, role=role)

    raise HTTPException(status_code=401, detail="Authentication required")


async def get_current_user(
    auth: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
) -> User:
    if not auth.user_id:
        raise HTTPException(status_code=401, detail="User authentication required")
    result = await session.execute(select(User).where(User.id == auth.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_worker(
    authorization: str | None = Header(default=None),
    session: AsyncSession = Depends(get_db),
) -> Worker:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Worker token required")
    token = authorization.removeprefix("Bearer ").strip()
    if not token.startswith(WORKER_TOKEN_PREFIX):
        raise HTTPException(status_code=401, detail="Invalid worker token")
    prefix = token[:16]
    result = await session.execute(select(Worker).where(Worker.token_prefix == prefix))
    worker = result.scalar_one_or_none()
    if not worker or not verify_worker_token_hash(token, worker.token_hash):
        raise HTTPException(status_code=401, detail="Invalid worker token")
    return worker


def require_permission(permission: str):
    async def _checker(auth: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if not auth.has_permission(permission):
            raise HTTPException(status_code=403, detail=f"Missing permission: {permission}")
        return auth

    return _checker
