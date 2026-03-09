"""
MediTrack CDSS - Pydantic Schemas

All request/response models for strict validation and serialization.
These schemas mirror the TypeScript types on the frontend exactly.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


# ============================================================
# ENUMERATIONS (as Literals for Pydantic v2 compatibility)
# ============================================================
from typing import Literal

UserRole = Literal["attending_physician", "ward_nurse"]
AdmissionStatus = Literal["active", "discharged", "transferred"]
ObservationType = Literal["vital_signs", "scan_report", "lab_result", "clinical_note", "medication"]
ActionDecision = Literal["accepted", "overridden", "pending", "dismissed"]
Gender = Literal["male", "female", "other", "prefer_not_to_say"]
CdssSeverity = Literal["critical", "warning", "informational"]


# ============================================================
# BASE CONFIG
# ============================================================
class BaseSchema(BaseModel):
    """Base config shared by all schemas: ORM mode enabled."""
    model_config = {"from_attributes": True}


# ============================================================
# USER SCHEMAS
# ============================================================
class UserBase(BaseSchema):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    role: UserRole
    ward: Optional[str] = Field(None, max_length=100)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserResponse(UserBase):
    id: uuid.UUID
    is_active: bool
    created_at: datetime


class AuthTokenResponse(BaseSchema):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class LoginRequest(BaseSchema):
    email: EmailStr
    password: str


# ============================================================
# PATIENT SCHEMAS
# ============================================================
class PatientBase(BaseSchema):
    mrn: str = Field(..., min_length=1, max_length=50, description="Medical Record Number")
    full_name: str = Field(..., min_length=2, max_length=255)
    date_of_birth: date
    gender: Optional[Gender] = None
    blood_type: Optional[str] = Field(None, max_length=5)
    allergies: list[str] = Field(default_factory=list)


class PatientCreate(PatientBase):
    pass


class PatientResponse(PatientBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    active_admission: Optional["AdmissionResponse"] = None


# ============================================================
# ADMISSION SCHEMAS
# ============================================================
class AdmissionBase(BaseSchema):
    ward: str = Field(..., max_length=100)
    bed_number: Optional[str] = Field(None, max_length=20)
    admission_reason: str = Field(..., min_length=5)
    primary_condition: str = Field(..., max_length=255)
    expected_los_hours: Optional[int] = Field(None, ge=1)


class AdmissionCreate(AdmissionBase):
    patient_id: uuid.UUID


class AdmissionResponse(AdmissionBase):
    id: uuid.UUID
    patient_id: uuid.UUID
    attending_id: uuid.UUID
    admitted_at: datetime
    discharged_at: Optional[datetime] = None
    status: AdmissionStatus
    created_at: datetime
    updated_at: datetime
    # Computed fields (populated by API layer)
    los_hours: float = 0.0
    los_days: float = 0.0
    is_los_exceeded: bool = False


# ============================================================
# CLINICAL OBSERVATION SCHEMAS
# ============================================================
class VitalSignsData(BaseSchema):
    heart_rate: Optional[int] = Field(None, ge=0, le=300)
    blood_pressure_systolic: Optional[int] = Field(None, ge=0, le=300)
    blood_pressure_diastolic: Optional[int] = Field(None, ge=0, le=200)
    temperature_celsius: Optional[float] = Field(None, ge=30.0, le=45.0)
    oxygen_saturation: Optional[float] = Field(None, ge=0.0, le=100.0)
    respiratory_rate: Optional[int] = Field(None, ge=0, le=100)


class ScanData(BaseSchema):
    scan_type: Optional[str] = Field(None, max_length=100)
    scan_status: Optional[str] = Field(None, max_length=100)
    scan_findings: Optional[str] = None
    dicom_link: Optional[str] = Field(None, max_length=500)


class ObservationCreate(VitalSignsData, ScanData):
    admission_id: uuid.UUID
    patient_id: uuid.UUID
    observation_type: ObservationType
    notes: Optional[str] = None
    observed_at: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_type_fields(self) -> "ObservationCreate":
        """Ensure required fields exist for each observation type."""
        if self.observation_type == "scan_report" and not self.scan_type:
            raise ValueError("scan_type is required for scan_report observations")
        if self.observation_type == "vital_signs" and not any([
            self.heart_rate, self.blood_pressure_systolic, self.temperature_celsius
        ]):
            raise ValueError("At least one vital sign value is required")
        return self


class ObservationResponse(VitalSignsData, ScanData):
    id: uuid.UUID
    admission_id: uuid.UUID
    patient_id: uuid.UUID
    recorded_by: uuid.UUID
    observation_type: ObservationType
    notes: Optional[str] = None
    observed_at: datetime
    created_at: datetime
    recorded_by_user: Optional[dict] = None


# ============================================================
# CDSS ENGINE SCHEMAS
# ============================================================
class CdssSuggestion(BaseSchema):
    rule_id: str
    suggested_action: str
    action_type: str
    rationale: str
    severity: CdssSeverity
    triggered_conditions: list[str]


class CdssEvaluationResult(BaseSchema):
    patient_id: uuid.UUID
    admission_id: uuid.UUID
    evaluated_at: datetime
    los_hours: float
    primary_condition: str
    latest_scan_status: Optional[str] = None
    suggestions: list[CdssSuggestion]
    has_critical_suggestions: bool


# ============================================================
# ACTION LOG SCHEMAS
# ============================================================
class ActionLogCreate(BaseSchema):
    admission_id: uuid.UUID
    patient_id: uuid.UUID
    suggestion_id: str
    suggested_action: str
    action_type: str
    rationale: Optional[str] = None


class ActionDecisionUpdate(BaseSchema):
    decision: Literal["accepted", "overridden", "dismissed"]
    physician_note: Optional[str] = None

    @model_validator(mode="after")
    def note_required_on_override(self) -> "ActionDecisionUpdate":
        if self.decision == "overridden" and not self.physician_note:
            raise ValueError("physician_note is required when overriding a CDSS suggestion")
        return self


class ActionLogResponse(BaseSchema):
    id: uuid.UUID
    admission_id: uuid.UUID
    patient_id: uuid.UUID
    triggered_by: Optional[uuid.UUID] = None
    suggestion_id: Optional[str] = None
    suggested_action: str
    action_type: str
    rationale: Optional[str] = None
    decision: Optional[ActionDecision] = None
    physician_note: Optional[str] = None
    decided_by: Optional[uuid.UUID] = None
    decided_at: Optional[datetime] = None
    created_at: datetime
    decided_by_user: Optional[dict] = None


# ============================================================
# PATIENT ROSTER (Dashboard aggregate)
# ============================================================
class PatientRosterEntry(BaseSchema):
    patient: PatientResponse
    admission: AdmissionResponse
    latest_observation: Optional[ObservationResponse] = None
    pending_suggestions_count: int = 0
    has_critical_alerts: bool = False


# ============================================================
# GENERIC API RESPONSE WRAPPERS
# ============================================================
class ApiMessage(BaseSchema):
    message: str


class PaginationParams(BaseSchema):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


# Allow forward references to resolve
PatientResponse.model_rebuild()
