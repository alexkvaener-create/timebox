/**
 * MediTrack CDSS - TypeScript Type Definitions
 *
 * Single source of truth for all data shapes used across the frontend.
 * These interfaces mirror the Pydantic schemas on the backend exactly.
 */

// ============================================================
// ENUMERATIONS
// ============================================================

export type UserRole = 'attending_physician' | 'ward_nurse';

export type AdmissionStatus = 'active' | 'discharged' | 'transferred';

export type ObservationType = 'vital_signs' | 'scan_report' | 'lab_result' | 'clinical_note' | 'medication';

export type ActionDecision = 'accepted' | 'overridden' | 'pending' | 'dismissed';

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

// ============================================================
// USER
// ============================================================

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  ward: string | null;
  is_active: boolean;
  created_at: string; // ISO 8601
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: 'bearer';
  user: User;
}

// ============================================================
// PATIENT
// ============================================================

export interface Patient {
  id: string;
  mrn: string;
  full_name: string;
  date_of_birth: string; // ISO 8601 date string
  gender: Gender | null;
  blood_type: string | null;
  allergies: string[];
  created_at: string;
  updated_at: string;
  // Computed/joined fields from the API
  active_admission?: Admission;
}

export interface PatientCreateInput {
  mrn: string;
  full_name: string;
  date_of_birth: string;
  gender?: Gender;
  blood_type?: string;
  allergies?: string[];
}

// ============================================================
// ADMISSION
// ============================================================

export interface Admission {
  id: string;
  patient_id: string;
  attending_id: string;
  ward: string;
  bed_number: string | null;
  admission_reason: string;
  primary_condition: string;
  admitted_at: string; // ISO 8601
  discharged_at: string | null;
  expected_los_hours: number | null;
  status: AdmissionStatus;
  created_at: string;
  updated_at: string;
  // Computed fields
  los_hours: number;        // Calculated: (now - admitted_at) in hours
  los_days: number;         // Calculated: los_hours / 24
  is_los_exceeded: boolean; // True if los_hours > expected_los_hours
}

export interface AdmissionCreateInput {
  patient_id: string;
  ward: string;
  bed_number?: string;
  admission_reason: string;
  primary_condition: string;
  expected_los_hours?: number;
}

// ============================================================
// CLINICAL OBSERVATION
// ============================================================

export interface VitalSigns {
  heart_rate: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  temperature_celsius: number | null;
  oxygen_saturation: number | null;
  respiratory_rate: number | null;
}

export interface ScanData {
  scan_type: string | null;
  scan_status: string | null;
  scan_findings: string | null;
  dicom_link: string | null;
}

export interface ClinicalObservation extends VitalSigns, ScanData {
  id: string;
  admission_id: string;
  patient_id: string;
  recorded_by: string;
  observation_type: ObservationType;
  notes: string | null;
  observed_at: string;
  created_at: string;
  // Joined
  recorded_by_user?: Pick<User, 'id' | 'full_name' | 'role'>;
}

export interface ObservationCreateInput extends Partial<VitalSigns>, Partial<ScanData> {
  admission_id: string;
  patient_id: string;
  observation_type: ObservationType;
  notes?: string;
  observed_at?: string;
}

// ============================================================
// CDSS ENGINE OUTPUT
// ============================================================

export type CdssSeverity = 'critical' | 'warning' | 'informational';

export interface CdssSuggestion {
  rule_id: string;              // e.g., 'CDSS-RULE-001'
  suggested_action: string;     // Human-readable action for the physician
  action_type: string;          // e.g., 'Order Drainage'
  rationale: string;            // Explanation of why this action was triggered
  severity: CdssSeverity;
  triggered_conditions: string[]; // Which rule conditions were met
}

export interface CdssEvaluationResult {
  patient_id: string;
  admission_id: string;
  evaluated_at: string;
  los_hours: number;
  primary_condition: string;
  latest_scan_status: string | null;
  suggestions: CdssSuggestion[];
  has_critical_suggestions: boolean;
}

// ============================================================
// ACTION LOG
// ============================================================

export interface ActionLog {
  id: string;
  admission_id: string;
  patient_id: string;
  triggered_by: string | null;
  suggestion_id: string | null;
  suggested_action: string;
  action_type: string;
  rationale: string | null;
  decision: ActionDecision | null;
  physician_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  // Joined
  decided_by_user?: Pick<User, 'id' | 'full_name'>;
}

export interface ActionLogCreateInput {
  admission_id: string;
  patient_id: string;
  suggestion_id: string;
  suggested_action: string;
  action_type: string;
  rationale?: string;
}

export interface ActionDecisionInput {
  decision: 'accepted' | 'overridden' | 'dismissed';
  physician_note?: string; // Required when decision === 'overridden'
}

// ============================================================
// API RESPONSE WRAPPERS
// ============================================================

export interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  detail: string;
  status_code: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

// ============================================================
// PATIENT ROSTER (Dashboard aggregate view)
// ============================================================

export interface PatientRosterEntry {
  patient: Patient;
  admission: Admission;
  latest_observation: ClinicalObservation | null;
  pending_suggestions_count: number;
  has_critical_alerts: boolean;
}
