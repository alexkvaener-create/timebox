/**
 * MediTrack CDSS - API Client
 *
 * Typed fetch wrapper for all backend API calls.
 * Reads the access token from localStorage and attaches it as a Bearer header.
 */
import type {
  ActionDecisionInput,
  ActionLog,
  ActionLogCreateInput,
  AuthTokenResponse,
  CdssEvaluationResult,
  ClinicalObservation,
  ObservationCreateInput,
  Patient,
  PatientCreateInput,
  PatientRosterEntry,
} from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';

// ---- Internal fetch wrapper ----

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mt_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new ApiError(response.status, error.detail ?? 'Request failed');
  }

  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly detail: string,
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

// ============================================================
// AUTH
// ============================================================

export const authApi = {
  login: (email: string, password: string): Promise<AuthTokenResponse> =>
    apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: (): Promise<AuthTokenResponse['user']> => apiFetch('/auth/me'),
};

// ============================================================
// PATIENTS
// ============================================================

export const patientsApi = {
  create: (data: PatientCreateInput): Promise<Patient> =>
    apiFetch('/patients', { method: 'POST', body: JSON.stringify(data) }),

  list: (params?: { ward?: string; flag_los?: boolean }): Promise<PatientRosterEntry[]> => {
    const qs = new URLSearchParams();
    if (params?.ward) qs.set('ward', params.ward);
    if (params?.flag_los) qs.set('flag_los', 'true');
    return apiFetch(`/patients${qs.size ? `?${qs}` : ''}`);
  },

  get: (patientId: string): Promise<Patient> => apiFetch(`/patients/${patientId}`),

  admit: (
    patientId: string,
    data: Omit<import('@/types').AdmissionCreateInput, 'patient_id'>,
  ): Promise<import('@/types').Admission> =>
    apiFetch(`/patients/${patientId}/admit`, { method: 'POST', body: JSON.stringify(data) }),

  discharge: (patientId: string): Promise<import('@/types').Admission> =>
    apiFetch(`/patients/${patientId}/discharge`, { method: 'PATCH' }),
};

// ============================================================
// OBSERVATIONS
// ============================================================

export const observationsApi = {
  create: (data: ObservationCreateInput): Promise<ClinicalObservation> =>
    apiFetch('/observations', { method: 'POST', body: JSON.stringify(data) }),

  listByAdmission: (admissionId: string): Promise<ClinicalObservation[]> =>
    apiFetch(`/observations/${admissionId}`),
};

// ============================================================
// CDSS
// ============================================================

export const cdssApi = {
  evaluate: (patientId: string): Promise<CdssEvaluationResult> =>
    apiFetch(`/cdss/evaluate/${patientId}`),

  createActionLog: (data: ActionLogCreateInput): Promise<ActionLog> =>
    apiFetch('/cdss/action-logs', { method: 'POST', body: JSON.stringify(data) }),

  decideActionLog: (logId: string, data: ActionDecisionInput): Promise<ActionLog> =>
    apiFetch(`/cdss/action-logs/${logId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getPatientActionLogs: (patientId: string): Promise<ActionLog[]> =>
    apiFetch(`/cdss/action-logs/patient/${patientId}`),
};
