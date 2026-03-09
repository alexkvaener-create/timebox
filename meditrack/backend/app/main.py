"""
MediTrack CDSS - FastAPI Application Entry Point

Registers all routers, configures CORS, and provides lifespan hooks
for database connection setup/teardown.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, cdss, observations, patients
from app.core.config import get_settings
from app.db.session import engine
from app.models import Base

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Create tables on startup (dev convenience). Use Alembic for production migrations."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "MediTrack Clinical Decision Support System API. "
        "Tracks patient admissions, clinical observations, and generates "
        "AI-assisted clinical action suggestions for physicians."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ---- CORS ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Routers ----
API_PREFIX = "/api"
app.include_router(auth.router,         prefix=API_PREFIX)
app.include_router(patients.router,     prefix=API_PREFIX)
app.include_router(observations.router, prefix=API_PREFIX)
app.include_router(cdss.router,         prefix=API_PREFIX)


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    """Liveness probe endpoint."""
    return {"status": "ok", "version": settings.APP_VERSION}
