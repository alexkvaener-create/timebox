"""
MediTrack CDSS - SQLAlchemy ORM Models

Declarative models using cross-database types (SQLite + PostgreSQL compatible).
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float, ForeignKey,
    Integer, JSON, String, Text, Uuid, func,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


class User(Base):
    __tablename__ = "users"

    id             = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email          = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name      = Column(String(255), nullable=False)
    role           = Column(String(50), nullable=False)   # 'attending_physician' | 'ward_nurse'
    ward           = Column(String(100), nullable=True)
    is_active      = Column(Boolean, nullable=False, default=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    admissions_attending = relationship("Admission", back_populates="attending", foreign_keys="Admission.attending_id")
    observations_recorded = relationship("ClinicalObservation", back_populates="recorder", foreign_keys="ClinicalObservation.recorded_by")
    action_logs_triggered = relationship("ActionLog", back_populates="triggerer", foreign_keys="ActionLog.triggered_by")
    action_logs_decided   = relationship("ActionLog", back_populates="decider", foreign_keys="ActionLog.decided_by")


class Patient(Base):
    __tablename__ = "patients"

    id             = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mrn            = Column(String(50), unique=True, nullable=False, index=True)
    full_name      = Column(String(255), nullable=False)
    date_of_birth  = Column(Date, nullable=False)
    gender         = Column(String(20), nullable=True)
    blood_type     = Column(String(5), nullable=True)
    allergies      = Column(JSON, nullable=True, default=list)
    created_at     = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    admissions   = relationship("Admission", back_populates="patient", cascade="all, delete-orphan")
    observations = relationship("ClinicalObservation", back_populates="patient", cascade="all, delete-orphan")
    action_logs  = relationship("ActionLog", back_populates="patient", cascade="all, delete-orphan")


class Admission(Base):
    __tablename__ = "admissions"

    id                  = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id          = Column(Uuid(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    attending_id        = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    ward                = Column(String(100), nullable=False, index=True)
    bed_number          = Column(String(20), nullable=True)
    admission_reason    = Column(Text, nullable=False)
    primary_condition   = Column(String(255), nullable=False)
    admitted_at         = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    discharged_at       = Column(DateTime(timezone=True), nullable=True)
    expected_los_hours  = Column(Integer, nullable=True)
    status              = Column(String(50), nullable=False, default="active", index=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    patient      = relationship("Patient", back_populates="admissions")
    attending    = relationship("User", back_populates="admissions_attending", foreign_keys=[attending_id])
    observations = relationship("ClinicalObservation", back_populates="admission", cascade="all, delete-orphan")
    action_logs  = relationship("ActionLog", back_populates="admission", cascade="all, delete-orphan")


class ClinicalObservation(Base):
    __tablename__ = "clinical_observations"

    id                       = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admission_id             = Column(Uuid(as_uuid=True), ForeignKey("admissions.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id               = Column(Uuid(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    recorded_by              = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    observation_type         = Column(String(50), nullable=False)
    # Vital signs
    heart_rate               = Column(Integer, nullable=True)
    blood_pressure_systolic  = Column(Integer, nullable=True)
    blood_pressure_diastolic = Column(Integer, nullable=True)
    temperature_celsius      = Column(Float, nullable=True)
    oxygen_saturation        = Column(Float, nullable=True)
    respiratory_rate         = Column(Integer, nullable=True)
    # Scan/Lab data
    scan_type                = Column(String(100), nullable=True)
    scan_status              = Column(String(100), nullable=True)
    scan_findings            = Column(Text, nullable=True)
    dicom_link               = Column(String(500), nullable=True)
    # General
    notes                    = Column(Text, nullable=True)
    observed_at              = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    created_at               = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    admission = relationship("Admission", back_populates="observations")
    patient   = relationship("Patient", back_populates="observations")
    recorder  = relationship("User", back_populates="observations_recorded", foreign_keys=[recorded_by])


class ActionLog(Base):
    __tablename__ = "action_logs"

    id               = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admission_id     = Column(Uuid(as_uuid=True), ForeignKey("admissions.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id       = Column(Uuid(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    triggered_by     = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=True)
    suggestion_id    = Column(String(100), nullable=True)
    suggested_action = Column(Text, nullable=False)
    action_type      = Column(String(100), nullable=False)
    rationale        = Column(Text, nullable=True)
    decision         = Column(String(50), nullable=True, index=True)
    physician_note   = Column(Text, nullable=True)
    decided_by       = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=True)
    decided_at       = Column(DateTime(timezone=True), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    admission  = relationship("Admission", back_populates="action_logs")
    patient    = relationship("Patient", back_populates="action_logs")
    triggerer  = relationship("User", back_populates="action_logs_triggered", foreign_keys=[triggered_by])
    decider    = relationship("User", back_populates="action_logs_decided", foreign_keys=[decided_by])
