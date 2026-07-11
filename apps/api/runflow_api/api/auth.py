"""Authentication routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.core.security import create_access_token, verify_password
from runflow_api.db import get_db
from runflow_api.deps import get_auth_context
from runflow_api.models import Organization, OrganizationMember, User
from runflow_api.schemas import LoginRequest, OrganizationResponse, TokenResponse, UserResponse
from runflow_api.core.authorization import AuthContext

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_db)):
    result = await session.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    member_result = await session.execute(
        select(OrganizationMember).where(OrganizationMember.user_id == user.id).limit(1)
    )
    member = member_result.scalar_one_or_none()
    org_id = member.organization_id if member else None

    token = create_access_token(user.id, {"org_id": org_id, "role": member.role if member else None})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(auth: AuthContext = Depends(get_auth_context), session: AsyncSession = Depends(get_db)):
    if not auth.user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    result = await session.execute(select(User).where(User.id == auth.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(id=user.id, email=user.email, enabled=user.enabled)


@router.get("/organization", response_model=OrganizationResponse)
async def get_organization(
    auth: AuthContext = Depends(get_auth_context), session: AsyncSession = Depends(get_db)
):
    if not auth.organization_id:
        raise HTTPException(status_code=404, detail="No organization")
    result = await session.execute(
        select(Organization).where(Organization.id == auth.organization_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return OrganizationResponse(id=org.id, name=org.name, slug=org.slug)
