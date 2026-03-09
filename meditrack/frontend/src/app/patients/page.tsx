'use client';

/**
 * Patient Roster View (Filtered)
 *
 * Filterable table of all active patients.
 * Rows for patients exceeding expected LOS are visually flagged in red.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

import TopBar from '@/components/layout/TopBar';
import LosFlag from '@/components/patients/LosFlag';
import { patientsApi } from '@/lib/api';
import { calculateAge, formatDateTime, titleCase } from '@/lib/utils';
import type { PatientRosterEntry } from '@/types';

export default function PatientRosterPage() {
  const [roster, setRoster] = useState<PatientRosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ward, setWard] = useState('');
  const [flagLos, setFlagLos] = useState(false);

  useEffect(() => {
    setLoading(true);
    patientsApi
      .list({ ward: ward || undefined, flag_los: flagLos })
      .then(setRoster)
      .finally(() => setLoading(false));
  }, [ward, flagLos]);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Patient Roster" subtitle="Active ward admissions" ward="4A" />

      <div className="flex-1 p-6">
        {/* Filters */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-xs">
            <span className="text-blue-700 font-medium">Ward 4A</span>
            <button onClick={() => setWard('')} className="text-blue-400 hover:text-blue-700">&times;</button>
          </div>
          <button
            onClick={() => setFlagLos((v) => !v)}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
              flagLos
                ? 'bg-red-500 text-white border-red-500'
                : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
            }`}
          >
            {flagLos ? 'Showing: High LOS' : 'Filter: High LOS'}
          </button>
          <span className="ml-auto text-xs text-slate-500">{roster.length} patients</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Patient Name', 'MRN', 'Ward', 'LOS (Days)', 'Condition', 'Scan Status', 'CDSS Sug.', 'Action'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">Loading patients...</td>
                </tr>
              )}
              {!loading && roster.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">No patients found.</td>
                </tr>
              )}
              {!loading && roster.map((entry) => (
                <tr
                  key={entry.patient.id}
                  className={`hover:bg-slate-50 ${entry.admission.is_los_exceeded ? 'bg-red-50/40' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {entry.patient.full_name}
                    <p className="text-xs text-slate-400 font-normal">
                      {calculateAge(entry.patient.date_of_birth)} yrs
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{entry.patient.mrn}</td>
                  <td className="px-4 py-3 text-slate-600">{entry.admission.ward}</td>
                  <td className="px-4 py-3">
                    <LosFlag
                      losHours={entry.admission.los_hours}
                      expectedLosHours={entry.admission.expected_los_hours}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{titleCase(entry.admission.primary_condition)}</td>
                  <td className="px-4 py-3">
                    {entry.latest_observation?.scan_status ? (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                        {titleCase(entry.latest_observation.scan_status)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {entry.pending_suggestions_count > 0 ? (
                      <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5 font-semibold">
                        {entry.pending_suggestions_count} pending
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/patients/${entry.patient.id}`}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                      View Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
