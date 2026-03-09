"""
MediTrack CDSS - Patients API Router

Endpoints:
  POST   /api/patients             — Create a new patient record
  GET    /api/patients             — List all patients (with active admission info)
  GET    /api/patients/{id}        — Get full patient detail
  POST   /api/patients/{id}/admit  — Admit a patient (create an Admission)
  PATCH  /api/patients/{id}/discharge — Discharge a patient
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import CurrentUser, require_clinical_staff, require_physician
from app.db.session import get_db
from app.models import Admission, Patient
from app.schemas import (
    AdmissionCreate,
    AdmissionResponse,
    PatientCreate,
    PatientResponse,
    PatientRosterEntry,
)

router = APIRouter(prefix="/patients", tags=["Patients"])


# ---- Helpers ----

def _compute_los(admission: Admission) -> tuple[float, float, bool]:
    """Return (los_hours, los_days, is_exceeded) for an admission."""
    end = admission.discharged_at or datetime.now(timezone.utc)
    # Ensure both datetimes are timezone-aware
    admitted = admission.admitted_at
    if admitted.tzinfo is None:
        admitted = admitted.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    los_hours = (end - admitted).total_seconds() / 3600
    los_days = los_hours / 24
    exceeded = bool(admission.expected_los_hours and los_hours > admission.expected_los_hours)
    return los_hours, los_days, exceeded


def _admission_to_response(admission: Admission) -> AdmissionResponse:
    los_hours, los_days, exceeded = _compute_los(admission)
    resp = AdmissionResponse.model_validate(admission)
    resp.los_hours = round(los_hours, 2)
    resp.los_days = round(los_days, 2)
    resp.is_los_exceeded = exceeded
    return resp


# ---- Routes ----

@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    payload: PatientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_clinical_staff),
) -> PatientResponse:
    """Create a new patient record. Accessible by all clinical staff."""
    # Check MRN uniqueness
    existing = await db.scalar(select(Patient).where(Patient.mrn == payload.mrn))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Patient with MRN '{payload.mrn}' already exists",
        )

    patient = Patient(**payload.model_dump())
    db.add(patient)
    await db.flush()
    await db.refresh(patient)
    return PatientResponse.model_validate(patient)


@router.get("", response_model=list[PatientRosterEntry])
async def list_patients(
    ward: Optional[str] = Query(None, description="Filter by ward"),
    flag_los: bool = Query(False, description="Only return patients who exceeded expected LOS"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_clinical_staff),
) -> list[PatientRosterEntry]:
    """
    Return all patients with an active admission, enriched with LOS flags.
    Used to populate the Patient Roster dashboard view.
    """
    query = (
        select(Admission)
        .where(Admission.status == "active")
        .options(
            selectinload(Admission.patient),
            selectinload(Admission.observations),
        )
    )
    if ward:
        query = query.where(Admission.ward == ward)

    result = await db.execute(query)
    admissions: list[Admission] = list(result.scalars().all())

    roster: list[PatientRosterEntry] = []
    for adm in admissions:
        admission_resp = _admission_to_response(adm)

        if flag_los and not admission_resp.is_los_exceeded:
            continue

        patient_resp = PatientResponse.model_validate(adm.patient)
        patient_resp.active_admission = admission_resp

        # Get latest observation (sorted by observed_at desc)
        latest_obs = None
        if adm.observations:
            latest_obs_model = max(adm.observations, key=lambda o: o.observed_at)
            from app.schemas import ObservationResponse
            latest_obs = ObservationResponse.model_validate(latest_obs_model)

        # Count pending action log suggestions
        from app.models import ActionLog
        pending_count_result = await db.execute(
            select(ActionLog)
            .where(ActionLog.admission_id == adm.id)
            .where(ActionLog.decision == "pending")
        )
        pending_count = len(list(pending_count_result.scalars().all()))

        roster.append(PatientRosterEntry(
            patient=patient_resp,
            admission=admission_resp,
            latest_observation=latest_obs,
            pending_suggestions_count=pending_count,
            has_critical_alerts=admission_resp.is_los_exceeded,
        ))

    return roster


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_clinical_staff),
) -> PatientResponse:
    """Retrieve full patient details including active admission."""
    result = await db.execute(
        select(Patient)
        .where(Patient.id == patient_id)
        .options(selectinload(Patient.admissions))
    )
    patient = result.scalar_one_or_none()

    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    # Attach active admission if it exists
    active_adm = next((a for a in patient.admissions if a.status == "active"), None)
    patient_resp = PatientResponse.model_validate(patient)
    if active_adm:
        patient_resp.active_admission = _admission_to_response(active_adm)

    return patient_resp


@router.post("/{patient_id}/admit", response_model=AdmissionResponse, status_code=status.HTTP_201_CREATED)
async def admit_patient(
    patient_id: uuid.UUID,
    payload: AdmissionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_physician),
) -> AdmissionResponse:
    """
    Admit a patient to a ward. Only attending physicians may admit patients.
    Raises 409 if the patient already has an active admission.
    """
    # Verify patient exists
    patient = await db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    # Prevent double-admissions
    existing = await db.scalar(
        select(Admission)
        .where(Admission.patient_id == patient_id)
        .where(Admission.status == "active")
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Patient already has an active admission",
        )

    admission = Admission(
        patient_id=patient_id,
        attending_id=current_user.user_id,
        **payload.model_dump(exclude={"patient_id"}),
    )
    db.add(admission)
    await db.flush()
    await db.refresh(admission)
    return _admission_to_response(admission)


@router.patch("/{patient_id}/discharge", response_model=AdmissionResponse)
async def discharge_patient(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_physician),
) -> AdmissionResponse:
    """Discharge a patient by marking the active admission as discharged."""
    admission = await db.scalar(
        select(Admission)
        .where(Admission.patient_id == patient_id)
        .where(Admission.status == "active")
    )
    if not admission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active admission found for this patient",
        )

    admission.status = "discharged"
    admission.discharged_at = datetime.now(timezone.utc)
    await db.flush()
    return _admission_to_response(admission)
