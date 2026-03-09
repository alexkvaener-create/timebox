'use client';

/**
 * Physician Dashboard (Main View)
 *
 * Shows:
 *  - Patient roster alerts (LOS anomalies)
 *  - A summary LOS bar chart placeholder
 *  - Recent CDSS suggestions
 *  - Ward overview stats
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

import TopBar from '@/components/layout/TopBar';
import LosFlag from '@/components/patients/LosFlag';
import { patientsApi } from '@/lib/api';
import { formatLos, titleCase } from '@/lib/utils';
import type { PatientRosterEntry } from '@/types';

export default function DashboardPage() {
  const [roster, setRoster] = useState<PatientRosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    patientsApi
      .list()
      .then(setRoster)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const exceededLos = roster.filter((r) => r.admission.is_los_exceeded);
  const criticalAlerts = roster.filter((r) => r.has_critical_alerts);

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Welcome, Dr. Anya Sharma (Attending Physician)"
        subtitle="Physician Dashboard"
        ward="4A"
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Alert strip */}
        {exceededLos.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-800 mb-2">Patient Roster Alerts</p>
            <ul className="space-y-1">
              {exceededLos.map((entry) => (
                <li key={entry.patient.id} className="flex items-center gap-2 text-xs text-red-700">
                  <span className="text-red-500">&#9873;</span>
                  <Link href={`/patients/${entry.patient.id}`} className="font-medium hover:underline">
                    {entry.patient.full_name}
                  </Link>
                  — {formatLos(entry.admission.los_hours)} LOS anomaly
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-3 gap-5">
          {/* Recent CDSS Suggestions */}
          <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-700 mb-3">Recent CDSS Suggestions</p>
            {loading && <p className="text-sm text-slate-400">Loading...</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
            {!loading && !error && roster.length === 0 && (
              <p className="text-sm text-slate-400">No active patients found.</p>
            )}
            {!loading && roster.map((entry) => (
              <div key={entry.patient.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <Link href={`/patients/${entry.patient.id}`} className="text-sm font-medium text-blue-700 hover:underline">
                    {entry.patient.full_name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {titleCase(entry.admission.primary_condition)} · Ward {entry.admission.ward}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {entry.pending_suggestions_count > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5 font-semibold">
                      {entry.pending_suggestions_count} pending
                    </span>
                  )}
                  <LosFlag
                    losHours={entry.admission.los_hours}
                    expectedLosHours={entry.admission.expected_los_hours}
                    compact
                  />
                  <Link
                    href={`/patients/${entry.patient.id}`}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Ward Overview */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-700">Ward Overview</p>
            <div className="space-y-2">
              <StatRow label="Active Patients"   value={roster.length} />
              <StatRow label="LOS Anomalies"     value={exceededLos.length} accent="text-red-600" />
              <StatRow label="Critical Alerts"   value={criticalAlerts.length} accent="text-red-600" />
              <StatRow label="Pending Decisions" value={roster.reduce((s, r) => s + r.pending_suggestions_count, 0)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  accent = 'text-slate-800',
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${accent}`}>{value}</p>
    </div>
  );
}
