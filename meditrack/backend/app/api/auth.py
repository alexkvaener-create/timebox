"""
MediTrack CDSS - Authentication Router

Endpoints:
  POST /api/auth/login   — Authenticate and receive a JWT
  GET  /api/auth/me      — Return current user profile
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    CurrentUser,
    create_access_token,
    get_current_user,
    verify_password,
)
from app.db.session import get_db
from app.models import User
from app.schemas import AuthTokenResponse, LoginRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=AuthTokenResponse)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthTokenResponse:
    """
    Authenticate a user with email and password.
    Returns a signed JWT valid for 8 hours along with the user profile.
    """
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    token = create_access_token(
        user_id=user.id,
        role=user.role,
        ward=user.ward,
    )
    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> UserResponse:
    """Return the currently authenticated user's profile."""
    user = await db.get(User, current_user.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserResponse.model_validate(user)
