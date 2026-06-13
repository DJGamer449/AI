from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "MelanTrance's Private Unlimited AI"
    app_password: str = Field(..., min_length=1, alias="APP_PASSWORD")
    orbit_api_key: str = Field(..., min_length=1, alias="ORBIT_API_KEY")
    app_secret: str = Field(default="", alias="APP_SECRET")
    orbit_base_url: str = Field(
        default="https://api.orbit-provider.com/api/provider/agy/v1", alias="ORBIT_BASE_URL"
    )
    session_ttl_seconds: int = Field(default=60 * 60 * 24, alias="SESSION_TTL_SECONDS")
    cors_origins_raw: str = Field(default="", alias="CORS_ORIGINS")
    request_timeout_seconds: float = Field(default=60.0, alias="REQUEST_TIMEOUT_SECONDS")
    cookie_secure: bool = Field(default=False, alias="COOKIE_SECURE")

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]

    @property
    def signing_secret(self) -> str:
        return self.app_secret or self.app_password


@lru_cache
def get_settings() -> Settings:
    return Settings()
