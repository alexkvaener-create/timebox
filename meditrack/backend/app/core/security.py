"""
MediTrack CDSS - Security Utilities

JWT token creation/verification and password hashing.
RBAC (Role-Based Access Control) dependency injectors for FastAPI routes.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_db

settings = get_settings()

# ---- Password hashing ----
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

bearer_scheme = HTTPBearer()


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# ---- JWT Tokens ----
def create_access_token(user_id: uuid.UUID, role: str, ward: Optional[str] = None) -> str:
    """Generate a signed JWT with user identity and role claims."""
    payload = {
        "sub": str(user_id),
        "role": role,
        "ward": ward,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT. Raises HTTPException on failure."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


# ---- FastAPI Dependencies ----

class CurrentUser:
    """Container for the authenticated user's claims extracted from the JWT."""
    def __init__(self, user_id: uuid.UUID, role: str, ward: Optional[str]):
        self.user_id = user_id
        self.role = role
        self.ward = ward


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    """Dependency: validates Bearer token and returns the current user's claims."""
    payload = decode_access_token(credentials.credentials)
    user_id_str = payload.get("sub")
    role = payload.get("role")
    ward = payload.get("ward")

    if not user_id_str or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    return CurrentUser(
        user_id=uuid.UUID(user_id_str),
        role=role,
        ward=ward,
    )


async def require_physician(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """Dependency: only attending_physicians may proceed."""
    if current_user.role != "attending_physician":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only attending physicians may perform this action",
        )
    return current_user


async def require_clinical_staff(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """Dependency: both physicians and ward nurses may proceed."""
    if current_user.role not in ("attending_physician", "ward_nurse"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clinical staff access required",
        )
    return current_user
