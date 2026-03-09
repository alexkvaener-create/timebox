"""
MediTrack CDSS - Clinical Observations API Router

Endpoints:
  POST  /api/observations                    — Record a new clinical observation
  GET   /api/observations/{admission_id}     — List all observations for an admission
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import CurrentUser, require_clinical_staff
from app.db.session import get_db
from app.models import Admission, ClinicalObservation, User
from app.schemas import ObservationCreate, ObservationResponse

router = APIRouter(prefix="/observations", tags=["Observations"])


@router.post("", response_model=ObservationResponse, status_code=status.HTTP_201_CREATED)
async def create_observation(
    payload: ObservationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_clinical_staff),
) -> ObservationResponse:
    """
    Record a new clinical observation (vital signs, scan report, lab result, etc.)
    for an active patient admission. Accessible by both physicians and nurses.
    """
    # Verify the admission exists and is active
    admission = await db.get(Admission, payload.admission_id)
    if not admission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admission not found")
    if admission.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add observations to a non-active admission",
        )

    # Confirm the patient_id matches the admission
    if admission.patient_id != payload.patient_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="patient_id does not match the admission record",
        )

    obs_data = payload.model_dump(exclude_none=True)
    obs_data["recorded_by"] = current_user.user_id
    if "observed_at" not in obs_data:
        obs_data["observed_at"] = datetime.now(timezone.utc)

    observation = ClinicalObservation(**obs_data)
    db.add(observation)
    await db.flush()
    await db.refresh(observation)

    # Attach recorder info for the response
    recorder = await db.get(User, current_user.user_id)
    resp = ObservationResponse.model_validate(observation)
    if recorder:
        resp.recorded_by_user = {
            "id": str(recorder.id),
            "full_name": recorder.full_name,
            "role": recorder.role,
        }
    return resp


@router.get("/{admission_id}", response_model=list[ObservationResponse])
async def list_observations(
    admission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_clinical_staff),
) -> list[ObservationResponse]:
    """
    Return all clinical observations for a given admission, sorted newest first.
    """
    # Verify admission exists
    admission = await db.get(Admission, admission_id)
    if not admission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admission not found")

    result = await db.execute(
        select(ClinicalObservation)
        .where(ClinicalObservation.admission_id == admission_id)
        .order_by(ClinicalObservation.observed_at.desc())
    )
    observations = list(result.scalars().all())
    return [ObservationResponse.model_validate(o) for o in observations]
