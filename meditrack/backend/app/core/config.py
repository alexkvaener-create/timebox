"""
MediTrack CDSS - Application Configuration

Settings are loaded from environment variables with sensible defaults
for local development. Use a .env file in the backend root.
"""
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ---- Application ----
    APP_NAME: str = "MediTrack CDSS API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # ---- Database ----
    # Defaults to SQLite for desktop/offline use; override with postgresql+asyncpg:// for production
    DATABASE_URL: str = "sqlite+aiosqlite:///./meditrack.db"

    # ---- Security ----
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_USE_32_CHAR_MIN_SECRET"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hours

    # ---- CORS ----
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton — avoids re-reading .env on every request."""
    return Settings()
