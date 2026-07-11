"""AI providers and Ask AI API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.core.encryption import encrypt
from runflow_api.deps import require_permission
from runflow_api.db import get_db
from runflow_api.models import AIProvider, Job
from runflow_api.services.ai.gateway import ask_ai, validate_ai_changes
from runflow_api.services.job_files import JobFileStorage
from runflow_api.utils import new_ulid
from runflow_api.core.authorization import AuthContext

router = APIRouter(prefix="/ai", tags=["ai"])


class AIProviderCreate(BaseModel):
    name: str
    provider_type: str
    model: str
    base_url: str | None = None
    api_key: str | None = None


class AIProviderResponse(BaseModel):
    id: str
    name: str
    provider_type: str
    model: str
    enabled: bool


class AskAIRequest(BaseModel):
    provider_id: str
    prompt: str
    job_id: str
    selected_file: str | None = None


class AskAIResponse(BaseModel):
    changes: list[dict[str, str]]


class ApplyAIRequest(BaseModel):
    job_id: str
    changes: list[dict[str, str]]


@router.get("/providers", response_model=list[AIProviderResponse])
async def list_providers(
    auth: AuthContext = Depends(require_permission("admin")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(AIProvider).where(AIProvider.organization_id == auth.organization_id)
    )
    return [AIProviderResponse(id=p.id, name=p.name, provider_type=p.provider_type,
                               model=p.model, enabled=p.enabled) for p in result.scalars().all()]


@router.post("/providers", response_model=AIProviderResponse, status_code=201)
async def create_provider(
    payload: AIProviderCreate,
    auth: AuthContext = Depends(require_permission("admin")),
    session: AsyncSession = Depends(get_db),
):
    ct, nonce = ("", "")
    if payload.api_key:
        ct, nonce = encrypt(payload.api_key)
    provider = AIProvider(
        id=new_ulid(), organization_id=auth.organization_id,
        name=payload.name, provider_type=payload.provider_type,
        model=payload.model, base_url=payload.base_url,
        encrypted_api_key=ct or None, api_key_nonce=nonce or None,
    )
    session.add(provider)
    await session.flush()
    return AIProviderResponse(id=provider.id, name=provider.name, provider_type=provider.provider_type,
                               model=provider.model, enabled=provider.enabled)


@router.post("/ask", response_model=AskAIResponse)
async def ask_ai_endpoint(
    payload: AskAIRequest,
    auth: AuthContext = Depends(require_permission("job:write")),
    session: AsyncSession = Depends(get_db),
):
    prov_result = await session.execute(
        select(AIProvider).where(AIProvider.id == payload.provider_id, AIProvider.enabled.is_(True))
    )
    provider = prov_result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="AI provider not found")

    job_result = await session.execute(select(Job).where(Job.id == payload.job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    storage = JobFileStorage()
    files = storage.list_tree(job.id)
    file_contents = {}
    for f in files:
        if not f["is_directory"]:
            try:
                file_contents[f["path"]] = storage.read_file(job.id, f["path"])
            except Exception:
                pass

    context = {
        "job": {"name": job.name, "runner_type": job.runner_type, "entrypoint": job.entrypoint},
        "files": file_contents,
        "selected_file": payload.selected_file,
    }
    result = await ask_ai(provider, payload.prompt, context)
    validated = validate_ai_changes(result["changes"])
    return AskAIResponse(changes=validated)


@router.post("/apply")
async def apply_ai_changes(
    payload: ApplyAIRequest,
    auth: AuthContext = Depends(require_permission("job:write")),
):
    validated = validate_ai_changes(payload.changes)
    storage = JobFileStorage()
    for change in validated:
        storage.write_file(payload.job_id, change["path"], change["content"])
    return {"applied": len(validated)}
