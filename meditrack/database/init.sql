-- MediTrack CDSS Database Initialization Script
-- PostgreSQL schema for the Clinical Decision Support System

-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS TABLE
-- Stores all system users: Attending Physicians and Ward Nurses
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    role          VARCHAR(50) NOT NULL CHECK (role IN ('attending_physician', 'ward_nurse')),
    ward          VARCHAR(100),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PATIENTS TABLE
-- Core patient demographic and identification data
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mrn           VARCHAR(50) UNIQUE NOT NULL,  -- Medical Record Number
    full_name     VARCHAR(255) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender        VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    blood_type    VARCHAR(5),
    allergies     TEXT[],
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ADMISSIONS TABLE
-- Tracks each patient ward episode; source of LOS calculation
-- ============================================================
CREATE TABLE IF NOT EXISTS admissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    attending_id    UUID NOT NULL REFERENCES users(id),
    ward            VARCHAR(100) NOT NULL,
    bed_number      VARCHAR(20),
    admission_reason TEXT NOT NULL,
    primary_condition VARCHAR(255) NOT NULL,  -- e.g., 'post-op', 'cardiac', 'respiratory'
    admitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    discharged_at   TIMESTAMPTZ,              -- NULL = currently admitted
    expected_los_hours INTEGER,               -- Expected length of stay in hours
    status          VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'discharged', 'transferred')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CLINICAL_OBSERVATIONS TABLE
-- Stores all clinical data points: vitals, scan results, notes
-- ============================================================
CREATE TABLE IF NOT EXISTS clinical_observations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admission_id    UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    recorded_by     UUID NOT NULL REFERENCES users(id),
    observation_type VARCHAR(50) NOT NULL CHECK (
        observation_type IN ('vital_signs', 'scan_report', 'lab_result', 'clinical_note', 'medication')
    ),
    -- Vital signs (nullable; populated when observation_type = 'vital_signs')
    heart_rate      INTEGER,
    blood_pressure_systolic  INTEGER,
    blood_pressure_diastolic INTEGER,
    temperature_celsius      NUMERIC(4,1),
    oxygen_saturation        NUMERIC(5,2),
    respiratory_rate         INTEGER,
    -- Scan/Lab data (nullable; populated for scan_report or lab_result)
    scan_type       VARCHAR(100),   -- e.g., 'CT Abdomen', 'MRI', 'X-Ray'
    scan_status     VARCHAR(100),   -- e.g., 'fluid_present', 'clear', 'inconclusive'
    scan_findings   TEXT,
    dicom_link      VARCHAR(500),
    -- General fields
    notes           TEXT,
    observed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ACTION_LOGS TABLE
-- Immutable audit trail of every CDSS suggestion and physician decision
-- ============================================================
CREATE TABLE IF NOT EXISTS action_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admission_id    UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    triggered_by    UUID REFERENCES users(id),  -- NULL = system-triggered
    suggestion_id   VARCHAR(100),               -- e.g., 'CDSS-RULE-001'
    suggested_action TEXT NOT NULL,             -- The CDSS suggested action text
    action_type     VARCHAR(100) NOT NULL,      -- e.g., 'Order Drainage', 'Dosage Observation'
    rationale       TEXT,                       -- Why the CDSS suggested this action
    decision        VARCHAR(50) CHECK (decision IN ('accepted', 'overridden', 'pending', 'dismissed')),
    physician_note  TEXT,                       -- Required when decision = 'overridden'
    decided_by      UUID REFERENCES users(id),
    decided_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES for performance on common query patterns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_admissions_patient_id ON admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status);
CREATE INDEX IF NOT EXISTS idx_admissions_ward ON admissions(ward);
CREATE INDEX IF NOT EXISTS idx_clinical_obs_admission_id ON clinical_observations(admission_id);
CREATE INDEX IF NOT EXISTS idx_clinical_obs_patient_id ON clinical_observations(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_obs_observed_at ON clinical_observations(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_logs_admission_id ON action_logs(admission_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_patient_id ON action_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_decision ON action_logs(decision);

-- ============================================================
-- SEED DATA: Demo users for development/testing
-- Passwords are bcrypt hashes of 'password123'
-- ============================================================
INSERT INTO users (email, hashed_password, full_name, role, ward) VALUES
    ('dr.sharma@meditrack.dev',  '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Dr. Anya Sharma',  'attending_physician', '4A'),
    ('dr.patel@meditrack.dev',   '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Dr. Rohan Patel',   'attending_physician', '4B'),
    ('nurse.chen@meditrack.dev', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Nurse Sarah Chen',  'ward_nurse',          '4A')
ON CONFLICT (email) DO NOTHING;
