"""AI Gateway - abstract provider interface."""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from typing import Any

import httpx

from runflow_api.core.encryption import decrypt
from runflow_api.models import AIProvider

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a coding assistant for RunFlow job scripts.
Respond ONLY with valid JSON in this format:
{"changes": [{"path": "relative/path.py", "content": "full file content"}]}
Do not include markdown fences. Only modify files within the job workspace."""


class BaseAIProvider(ABC):
    @abstractmethod
    async def complete(self, messages: list[dict], model: str) -> str:
        pass


class OpenAICompatibleProvider(BaseAIProvider):
    def __init__(self, api_key: str, base_url: str = "https://api.openai.com/v1"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    async def complete(self, messages: list[dict], model: str) -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": model, "messages": messages, "temperature": 0.2},
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]


class OllamaProvider(BaseAIProvider):
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url.rstrip("/")

    async def complete(self, messages: list[dict], model: str) -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{self.base_url}/api/chat",
                json={"model": model, "messages": messages, "stream": False},
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"]


def get_provider_instance(provider: AIProvider) -> BaseAIProvider:
    api_key = ""
    if provider.encrypted_api_key and provider.api_key_nonce:
        api_key = decrypt(provider.encrypted_api_key, provider.api_key_nonce)

    ptype = provider.provider_type
    base_url = provider.base_url or ""

    if ptype == "ollama":
        return OllamaProvider(base_url or "http://localhost:11434")
    if ptype in ("openai", "openrouter", "openai_compatible"):
        url = base_url or ("https://openrouter.ai/api/v1" if ptype == "openrouter" else "https://api.openai.com/v1")
        return OpenAICompatibleProvider(api_key, url)
    if ptype == "anthropic":
        return OpenAICompatibleProvider(api_key, base_url or "https://api.anthropic.com/v1")
    return OpenAICompatibleProvider(api_key, base_url or "https://api.openai.com/v1")


async def ask_ai(provider: AIProvider, user_prompt: str, context: dict[str, Any]) -> dict:
    instance = get_provider_instance(provider)
    context_str = json.dumps(context, ensure_ascii=False, indent=2)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Context:\n{context_str}\n\nRequest: {user_prompt}"},
    ]
    raw = await instance.complete(messages, provider.model)
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        data = json.loads(raw)
        if "changes" not in data or not isinstance(data["changes"], list):
            raise ValueError("Response must contain 'changes' array")
        return data
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid AI response JSON: {exc}") from exc


def validate_ai_changes(changes: list[dict], allowed_prefix: str = "") -> list[dict]:
    """Validate and sanitize AI-proposed file changes."""
    validated = []
    for change in changes:
        path = change.get("path", "")
        if ".." in path or path.startswith("/"):
            raise ValueError(f"Invalid path from AI: {path}")
        if not path or "content" not in change:
            raise ValueError("Each change must have path and content")
        validated.append({"path": path, "content": change["content"]})
    return validated
