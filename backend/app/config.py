"""Application configuration loaded from environment variables."""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Runtime configuration read from the environment."""

    fortyguard_api_key: str = Field(
        default="",
        alias="FORTYGUARD_API_KEY",
        description="API key for the FortyGuard Temperature API.",
    )
    fortyguard_base_url: str = Field(
        default="https://api.fortyguard.com",
        alias="FORTYGUARD_BASE_URL",
        description="Base URL for the FortyGuard API.",
    )
    cors_origins: str = Field(
        default="*",
        alias="CORS_ORIGINS",
        description="Comma-separated list of allowed CORS origins.",
    )
    osrm_foot_url: str = Field(
        default="https://router.project-osrm.org/route/v1/foot",
        alias="OSRM_FOOT_URL",
    )
    nominatim_url: str = Field(
        default="https://nominatim.openstreetmap.org/search",
        alias="NOMINATIM_URL",
    )
    request_timeout: int = Field(default=20, alias="REQUEST_TIMEOUT")

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def fortyguard_enabled(self) -> bool:
        return bool(self.fortyguard_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()


def env(name: str, default: Optional[str] = None) -> Optional[str]:
    """Convenience accessor for one-off environment reads."""
    return os.environ.get(name, default)
