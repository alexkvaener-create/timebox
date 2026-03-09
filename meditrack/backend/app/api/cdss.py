"""
MediTrack CDSS - Clinical Decision Support Engine API Router

Endpoints:
  GET   /api/cdss/evaluate/{patient_id}     — Run the CDSS engine for a patient
  POST  /api/cdss/action-logs               — Create a pending action log entry
  PATCH /api/cdss/action-logs/{log_id}      — Physician accepts / overrides a suggestion
  GET   /api/cdss/action-logs/{patient_id}  — Retrieve full audit trail for a patient
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import CurrentUser, require_clinical_staff, require_physician
from app.db.session import get_db
from app.models import Admission, ActionLog, ClinicalObservation
from app.schemas import (
    ActionDecisionUpdate,
    ActionLogCreate,
    ActionLogResponse,
    CdssEvaluationResult,
)
from app.services.cdss_engine import PatientContext, evaluate_patient

router = APIRouter(prefix="/cdss", tags=["CDSS"])


# ============================================================
# CDSS EVALUATION
# ============================================================

@router.get("/evaluate/{patient_id}", response_model=CdssEvaluationResult)
async def evaluate_patient_cdss(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_clinical_staff),
) -> CdssEvaluationResult:
    """
    Run the CDSS rule engine against the patient's current admission and
    latest clinical observations. Returns a list of action suggestions.

    This endpoint is the core intelligence of the system. It:
    1. Loads the patient's active admission (calculates LOS).
    2. Fetches the most recent scan and vital sign observations.
    3. Runs all registered CDSS rules against this context.
    4. Returns the ranked list of clinical suggestions.
    """
    # ---- 1. Load active admission ----
    result = await db.execute(
        select(Admission)
        .where(Admission.patient_id == patient_id)
        .where(Admission.status == "active")
    )
    admission = result.scalar_one_or_none()

    if not admission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active admission found for this patient",
        )

    # ---- 2. Calculate LOS ----
    now = datetime.now(timezone.utc)
    admitted_at = admission.admitted_at
    if admitted_at.tzinfo is None:
        admitted_at = admitted_at.replace(tzinfo=timezone.utc)
    los_hours = (now - admitted_at).total_seconds() / 3600

    # ---- 3. Fetch latest scan observation ----
    scan_result = await db.execute(
        select(ClinicalObservation)
        .where(ClinicalObservation.admission_id == admission.id)
        .where(ClinicalObservation.observation_type == "scan_report")
        .order_by(ClinicalObservation.observed_at.desc())
        .limit(1)
    )
    latest_scan = scan_result.scalar_one_or_none()

    # ---- 4. Fetch latest vitals observation ----
    vitals_result = await db.execute(
        select(ClinicalObservation)
        .where(ClinicalObservation.admission_id == admission.id)
        .where(ClinicalObservation.observation_type == "vital_signs")
        .order_by(ClinicalObservation.observed_at.desc())
        .limit(1)
    )
    latest_vitals = vitals_result.scalar_one_or_none()

    # ---- 5. Build context and run engine ----
    ctx = PatientContext(
        patient_id=str(patient_id),
        admission_id=str(admission.id),
        los_hours=los_hours,
        primary_condition=admission.primary_condition,
        latest_scan_status=latest_scan.scan_status if latest_scan else None,
        latest_scan_type=latest_scan.scan_type if latest_scan else None,
        heart_rate=latest_vitals.heart_rate if latest_vitals else None,
        blood_pressure_systolic=latest_vitals.blood_pressure_systolic if latest_vitals else None,
        oxygen_saturation=latest_vitals.oxygen_saturation if latest_vitals else None,
        temperature_celsius=latest_vitals.temperature_celsius if latest_vitals else None,
        expected_los_hours=admission.expected_los_hours,
    )

    return evaluate_patient(ctx)


# ============================================================
# ACTION LOGS
# ============================================================

@router.post("/action-logs", response_model=ActionLogResponse, status_code=status.HTTP_201_CREATED)
async def create_action_log(
    payload: ActionLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_clinical_staff),
) -> ActionLogResponse:
    """
    Persist a CDSS suggestion to the action_logs table with decision='pending'.
    This is called automatically by the frontend when a suggestion is displayed.
    """
    log = ActionLog(
        admission_id=payload.admission_id,
        patient_id=payload.patient_id,
        triggered_by=current_user.user_id,
        suggestion_id=payload.suggestion_id,
        suggested_action=payload.suggested_action,
        action_type=payload.action_type,
        rationale=payload.rationale,
        decision="pending",
    )
    db.add(log)
    await db.flush()
    await db.refresh(log)
    return ActionLogResponse.model_validate(log)


@router.patch("/action-logs/{log_id}", response_model=ActionLogResponse)
async def decide_action_log(
    log_id: uuid.UUID,
    payload: ActionDecisionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_physician),
) -> ActionLogResponse:
    """
    Record a physician's decision on a CDSS suggestion (accept, override, or dismiss).
    Only attending physicians may make this decision.
    An 'overridden' decision REQUIRES a physician_note explaining the clinical reasoning.
    """
    log = await db.get(ActionLog, log_id)
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action log not found")

    if log.decision not in (None, "pending"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Decision already recorded: '{log.decision}'",
        )

    log.decision = payload.decision
    log.physician_note = payload.physician_note
    log.decided_by = current_user.user_id
    log.decided_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(log)
    return ActionLogResponse.model_validate(log)


@router.get("/action-logs/patient/{patient_id}", response_model=list[ActionLogResponse])
async def get_patient_action_logs(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_clinical_staff),
) -> list[ActionLogResponse]:
    """
    Return the complete audit trail of CDSS suggestions and physician decisions
    for a patient, sorted newest first.
    """
    result = await db.execute(
        select(ActionLog)
        .where(ActionLog.patient_id == patient_id)
        .order_by(ActionLog.created_at.desc())
    )
    logs = list(result.scalars().all())
    return [ActionLogResponse.model_validate(log) for log in logs]
