'use client';

import { formatDateTime, titleCase } from '@/lib/utils';
import type { ActionLog } from '@/types';

interface ActionLogTableProps {
  logs: ActionLog[];
}

const decisionBadge: Record<string, string> = {
  accepted:  'bg-green-100 text-green-700',
  overridden: 'bg-amber-100 text-amber-700',
  dismissed:  'bg-slate-100 text-slate-600',
  pending:    'bg-blue-100 text-blue-700',
};

export default function ActionLogTable({ logs }: ActionLogTableProps) {
  if (logs.length === 0) {
    return <p className="text-sm text-slate-500 py-6 text-center">No action logs yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {['Timestamp', 'Suggested Action', 'Action Type', 'Decision', 'Physician Note'].map((col) => (
              <th key={col} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                {formatDateTime(log.created_at)}
              </td>
              <td className="px-3 py-2 font-medium text-slate-800 max-w-xs truncate">
                {log.suggested_action}
              </td>
              <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                {titleCase(log.action_type)}
              </td>
              <td className="px-3 py-2">
                {log.decision ? (
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${decisionBadge[log.decision] ?? 'bg-slate-100 text-slate-600'}`}>
                    {log.decision}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-slate-600 max-w-xs truncate italic">
                {log.physician_note ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
