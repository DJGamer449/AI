import time
from typing import Any, Dict, List

import httpx
from fastapi import HTTPException, status

from .config import Settings


class OrbitClient:
    """Small async client for Orbit Provider API with model-list caching."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._models_cache: List[Dict[str, Any]] = []
        self._models_cache_until = 0.0

    @property
    def _headers(self) -> Dict[str, str]:
        return {"x-api-key": self.settings.orbit_api_key}

    async def fetch_models(self, force: bool = False) -> List[Dict[str, Any]]:
        now = time.time()
        if not force and self._models_cache and now < self._models_cache_until:
            return self._models_cache

        try:
            async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
                response = await client.get(f"{self.settings.orbit_base_url}/models", headers=self._headers)
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=exc.response.status_code,
                detail=f"Orbit models request failed: {exc.response.text[:500]}",
            ) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Orbit models request failed: {exc}",
            ) from exc

        models = data.get("data", data if isinstance(data, list) else [])
        if not isinstance(models, list):
            models = []
        self._models_cache = models
        self._models_cache_until = now + 300
        return models

    async def create_message(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        headers = {
            **self._headers,
            "content-type": "application/json",
            "anthropic-version": "2023-06-01",
        }
        try:
            async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
                response = await client.post(f"{self.settings.orbit_base_url}/messages", headers=headers, json=payload)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=exc.response.status_code,
                detail=f"Orbit chat request failed: {exc.response.text[:1000]}",
            ) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Orbit chat request failed: {exc}",
            ) from exc
