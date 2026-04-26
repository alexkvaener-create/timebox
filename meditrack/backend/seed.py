"""
MediTrack - Database seed script for desktop/SQLite mode.
Creates demo users, patients, admissions and observations on first run.
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta

import bcrypt
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import select

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.models import Base, User, Patient, Admission, ClinicalObservation


DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./meditrack.db")


async def seed():
    engine = create_async_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(bind=engine, expire_on_commit=False)

    async with Session() as db:
        # Skip if already seeded
        existing = await db.scalar(select(User))
        if existing:
            print("Already seeded, skipping.")
            return

        hashed = bcrypt.hashpw(b"password123", bcrypt.gensalt(12)).decode()

        # --- Users ---
        dr_sharma = User(id=uuid.uuid4(), email="dr.sharma@meditrack.dev",
            hashed_password=hashed, full_name="Dr. Anya Sharma",
            role="attending_physician", ward="4A")
        nurse_chen = User(id=uuid.uuid4(), email="nurse.chen@meditrack.dev",
            hashed_password=hashed, full_name="Nurse Sarah Chen",
            role="ward_nurse", ward="4A")
        db.add_all([dr_sharma, nurse_chen])
        await db.flush()

        # --- Patients ---
        p1 = Patient(id=uuid.uuid4(), mrn="00033022", full_name="Anya Sharma",
            date_of_birth="1975-06-15", gender="female", blood_type="A+",
            allergies=["penicillin"])
        p2 = Patient(id=uuid.uuid4(), mrn="00053354", full_name="Anya Smith",
            date_of_birth="1982-11-03", gender="female", blood_type="B+", allergies=[])
        p3 = Patient(id=uuid.uuid4(), mrn="00033340", full_name="Dursan Sharma",
            date_of_birth="1968-04-22", gender="male", blood_type="O+", allergies=[])
        db.add_all([p1, p2, p3])
        await db.flush()

        now = datetime.now(timezone.utc)

        # --- Admissions (backdated for LOS anomalies) ---
        a1 = Admission(id=uuid.uuid4(), patient_id=p1.id, attending_id=dr_sharma.id,
            ward="4A", bed_number="12", admission_reason="Post-appendectomy recovery",
            primary_condition="post-op", expected_los_hours=48, status="active",
            admitted_at=now - timedelta(hours=80))
        a2 = Admission(id=uuid.uuid4(), patient_id=p2.id, attending_id=dr_sharma.id,
            ward="4A", bed_number="8", admission_reason="Cardiac monitoring",
            primary_condition="cardiac", expected_los_hours=72, status="active",
            admitted_at=now - timedelta(hours=85))
        a3 = Admission(id=uuid.uuid4(), patient_id=p3.id, attending_id=dr_sharma.id,
            ward="4A", bed_number="3", admission_reason="Respiratory distress",
            primary_condition="respiratory", expected_los_hours=24, status="active",
            admitted_at=now - timedelta(hours=30))
        db.add_all([a1, a2, a3])
        await db.flush()

        # --- Observations ---
        obs1 = ClinicalObservation(id=uuid.uuid4(), admission_id=a1.id, patient_id=p1.id,
            recorded_by=nurse_chen.id, observation_type="scan_report",
            scan_type="CT Abdomen/Pelvis", scan_status="fluid_present",
            scan_findings="Fluid found in post-op area",
            observed_at=now - timedelta(hours=2))
        obs2 = ClinicalObservation(id=uuid.uuid4(), admission_id=a3.id, patient_id=p3.id,
            recorded_by=nurse_chen.id, observation_type="vital_signs",
            heart_rate=75, blood_pressure_systolic=118, blood_pressure_diastolic=76,
            oxygen_saturation=88.5, temperature_celsius=37.2,
            observed_at=now - timedelta(hours=1))
        db.add_all([obs1, obs2])
        await db.commit()

    print("Database seeded successfully.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
