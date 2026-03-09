'use client';

/**
 * SuggestionCard — the prominent CDSS action card shown on the Patient Detail view.
 *
 * Displays the suggested clinical action, rationale, triggered conditions,
 * and "Accept" / "Override" action buttons.
 */
import { useState } from 'react';

import { cdssApi } from '@/lib/api';
import { severityBg, severityBadge, titleCase } from '@/lib/utils';
import type { ActionLog, CdssSuggestion } from '@/types';

interface SuggestionCardProps {
  suggestion: CdssSuggestion;
  patientId: string;
  admissionId: string;
  /** Called with the created ActionLog after a decision is made */
  onDecision: (log: ActionLog) => void;
}

export default function SuggestionCard({
  suggestion,
  patientId,
  admissionId,
  onDecision,
}: SuggestionCardProps) {
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideNote, setOverrideNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState(false);

  async function handleDecision(decision: 'accepted' | 'overridden') {
    setLoading(true);
    setError(null);
    try {
      // First, persist the suggestion as a log entry
      const logEntry = await cdssApi.createActionLog({
        admission_id: admissionId,
        patient_id: patientId,
        suggestion_id: suggestion.rule_id,
        suggested_action: suggestion.suggested_action,
        action_type: suggestion.action_type,
        rationale: suggestion.rationale,
      });

      // Then record the physician's decision
      const decidedLog = await cdssApi.decideActionLog(logEntry.id, {
        decision,
        physician_note: decision === 'overridden' ? overrideNote : undefined,
      });

      setDecided(true);
      onDecision(decidedLog);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  if (decided) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
        <p className="text-sm text-slate-600 font-medium">Decision recorded</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border-2 p-4 ${severityBg(suggestion.severity)}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide ${severityBadge(suggestion.severity)}`}>
              {suggestion.severity}
            </span>
            <span className="text-xs text-slate-500 font-mono">{suggestion.rule_id}</span>
          </div>
          <h3 className="text-base font-bold">SUGGESTED NEXT ACTION</h3>
          <p className="text-xl font-extrabold mt-0.5 uppercase tracking-tight">
            {suggestion.action_type}
          </p>
        </div>
      </div>

      {/* Suggested action detail */}
      <p className="text-sm font-semibold mb-2">{suggestion.suggested_action}</p>

      {/* Rationale */}
      <p className="text-xs leading-relaxed mb-3 opacity-80">{suggestion.rationale}</p>

      {/* Triggered conditions */}
      <div className="mb-4">
        <p className="text-xs font-semibold mb-1 uppercase tracking-wide">Triggered by:</p>
        <ul className="space-y-0.5">
          {suggestion.triggered_conditions.map((cond, i) => (
            <li key={i} className="text-xs flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 flex-shrink-0" />
              {cond}
            </li>
          ))}
        </ul>
      </div>

      {/* Override note input */}
      {overrideMode && (
        <div className="mb-3">
          <label className="block text-xs font-semibold mb-1">
            Override reason <span className="text-red-600">*</span>
          </label>
          <textarea
            className="w-full rounded-lg border border-current/30 bg-white/70 p-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-current/40"
            rows={3}
            placeholder="Document your clinical reasoning for overriding this suggestion..."
            value={overrideNote}
            onChange={(e) => setOverrideNote(e.target.value)}
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-3">{error}</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {!overrideMode ? (
          <>
            <button
              onClick={() => handleDecision('accepted')}
              disabled={loading}
              className="flex-1 py-2 px-4 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : 'Accept'}
            </button>
            <button
              onClick={() => setOverrideMode(true)}
              disabled={loading}
              className="flex-1 py-2 px-4 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              Override
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => handleDecision('overridden')}
              disabled={loading || !overrideNote.trim()}
              className="flex-1 py-2 px-4 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : 'Confirm Override'}
            </button>
            <button
              onClick={() => { setOverrideMode(false); setOverrideNote(''); }}
              disabled={loading}
              className="py-2 px-3 rounded-lg border border-current/30 text-sm font-semibold hover:bg-black/5 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
