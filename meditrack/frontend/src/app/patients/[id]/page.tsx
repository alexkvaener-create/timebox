'use client';

/**
 * Patient Detail View
 *
 * Shows:
 *  - Patient summary (MRN, age, condition, LOS)
 *  - CDSS "Suggested Next Action" card (prominent, at top)
 *  - Timeline of clinical observations
 *  - Full action log audit trail
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import TopBar from '@/components/layout/TopBar';
import LosFlag from '@/components/patients/LosFlag';
import SuggestionCard from '@/components/cdss/SuggestionCard';
import ActionLogTable from '@/components/cdss/ActionLogTable';
import { cdssApi, observationsApi, patientsApi } from '@/lib/api';
import { calculateAge, formatDateTime, titleCase } from '@/lib/utils';
import type { ActionLog, CdssEvaluationResult, ClinicalObservation, Patient } from '@/types';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [cdssResult, setCdssResult] = useState<CdssEvaluationResult | null>(null);
  const [observations, setObservations] = useState<ClinicalObservation[]>([]);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [activeTab, setActiveTab] = useState<'summary' | 'history' | 'cdss'>('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    Promise.all([
      patientsApi.get(id),
      cdssApi.evaluate(id).catch(() => null),
      cdssApi.getPatientActionLogs(id).catch(() => []),
    ])
      .then(async ([pat, cdss, logs]) => {
        setPatient(pat);
        setCdssResult(cdss);
        setActionLogs(logs);

        // Load observations if we have an active admission
        if (pat.active_admission) {
          const obs = await observationsApi.listByAdmission(pat.active_admission.id).catch(() => []);
          setObservations(obs);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        Loading patient data...
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-red-500">
        {error ?? 'Patient not found'}
      </div>
    );
  }

  const adm = patient.active_admission;

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title={patient.full_name}
        subtitle={`MRN: ${patient.mrn} · ${calculateAge(patient.date_of_birth)} yrs · ${titleCase(patient.gender ?? 'unknown')}`}
        ward={adm?.ward}
        backHref="/dashboard"
        backLabel="Patient Roster"
      />

      <div className="flex-1 p-6 grid grid-cols-3 gap-5 overflow-auto">
        {/* Left column: Summary + Timeline */}
        <div className="col-span-2 space-y-5">
          {/* Summary card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Summary</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                  <Row label="Patient Name" value={patient.full_name} />
                  <Row label="MRN"          value={patient.mrn} mono />
                  <Row label="Ward"         value={adm?.ward ?? '—'} />
                  <Row label="Bed"          value={adm?.bed_number ?? '—'} />
                  <Row label="LOS (Days)"   value={adm ? `${adm.los_days.toFixed(1)}d` : '—'} />
                  <Row label="Condition"    value={titleCase(adm?.primary_condition ?? '—')} />
                </div>
              </div>
              {adm && (
                <div className="text-right">
                  <LosFlag losHours={adm.los_hours} expectedLosHours={adm.expected_los_hours} />
                  <p className="text-xs text-slate-400 mt-1">Admitted {formatDateTime(adm.admitted_at)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex border-b border-slate-200">
              {(['summary', 'history', 'cdss'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-3 text-xs font-semibold capitalize transition-colors ${
                    activeTab === tab
                      ? 'border-b-2 border-blue-600 text-blue-700 bg-blue-50/50'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab === 'cdss' ? 'CDSS Suggestions' : tab}
                </button>
              ))}
            </div>

            <div className="p-5">
              {activeTab === 'summary' && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Admission Timeline</p>
                  {adm ? (
                    <div className="space-y-3">
                      <TimelineEvent
                        time={formatDateTime(adm.admitted_at)}
                        title="Admitted to ward"
                        detail={adm.admission_reason}
                      />
                      {observations.slice(0, 5).map((obs) => (
                        <TimelineEvent
                          key={obs.id}
                          time={formatDateTime(obs.observed_at)}
                          title={titleCase(obs.observation_type)}
                          detail={
                            obs.scan_findings ??
                            obs.notes ??
                            (obs.heart_rate ? `HR: ${obs.heart_rate} bpm` : undefined)
                          }
                          badge={obs.scan_status ? titleCase(obs.scan_status) : undefined}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No active admission.</p>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    All Clinical Observations ({observations.length})
                  </p>
                  {observations.length === 0 ? (
                    <p className="text-sm text-slate-400">No observations recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {observations.map((obs) => (
                        <div key={obs.id} className="border border-slate-100 rounded-lg p-3 bg-slate-50/50">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-slate-700">{titleCase(obs.observation_type)}</span>
                            <span className="text-xs text-slate-400">{formatDateTime(obs.observed_at)}</span>
                          </div>
                          {obs.scan_type && <p className="text-xs text-slate-600">Type: {obs.scan_type}</p>}
                          {obs.scan_status && (
                            <p className="text-xs">
                              Status: <span className="font-medium text-orange-700">{titleCase(obs.scan_status)}</span>
                            </p>
                          )}
                          {obs.scan_findings && <p className="text-xs text-slate-600 italic">&ldquo;{obs.scan_findings}&rdquo;</p>}
                          {obs.heart_rate && (
                            <p className="text-xs text-slate-600">
                              HR: {obs.heart_rate} · BP: {obs.blood_pressure_systolic}/{obs.blood_pressure_diastolic} ·
                              SpO2: {obs.oxygen_saturation}%
                            </p>
                          )}
                          {obs.notes && <p className="text-xs text-slate-500 mt-1">{obs.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'cdss' && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Audit Trail — All Suggestions &amp; Decisions
                  </p>
                  <ActionLogTable logs={actionLogs} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: CDSS Suggestion Cards */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">CDSS Suggestions</p>

          {!cdssResult || cdssResult.suggestions.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
              <p className="text-sm font-semibold text-green-800">No active suggestions</p>
              <p className="text-xs text-green-600 mt-1">All clinical parameters within expected range.</p>
            </div>
          ) : (
            cdssResult.suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.rule_id}
                suggestion={suggestion}
                patientId={patient.id}
                admissionId={adm?.id ?? ''}
                onDecision={(log) => setActionLogs((prev) => [log, ...prev])}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Small helpers ----

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium text-slate-800 ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</span>
    </>
  );
}

function TimelineEvent({
  time,
  title,
  detail,
  badge,
}: {
  time: string;
  title: string;
  detail?: string;
  badge?: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-2.5 h-2.5 rounded-full bg-blue-400 flex-shrink-0 mt-0.5" />
        <div className="w-px flex-1 bg-slate-200 mt-1" />
      </div>
      <div className="pb-3">
        <p className="text-xs text-slate-400">{time}</p>
        <p className="text-xs font-semibold text-slate-700">{title}</p>
        {detail && <p className="text-xs text-slate-500">{detail}</p>}
        {badge && (
          <span className="inline-block mt-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
