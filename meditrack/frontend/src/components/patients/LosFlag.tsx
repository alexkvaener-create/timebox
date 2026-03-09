/**
 * LosFlag — visual indicator for Length-of-Stay anomalies.
 * Renders a coloured pill: red for exceeded, amber for near-threshold, green for normal.
 */
import { formatLos } from '@/lib/utils';

interface LosFlagProps {
  losHours: number;
  expectedLosHours: number | null;
  compact?: boolean;
}

export default function LosFlag({ losHours, expectedLosHours, compact = false }: LosFlagProps) {
  const exceeded = expectedLosHours !== null && losHours > expectedLosHours;
  const nearThreshold = expectedLosHours !== null && losHours > expectedLosHours * 0.85 && !exceeded;

  let colourClass: string;
  let label: string;

  if (exceeded) {
    colourClass = 'bg-red-100 text-red-700 border-red-300';
    label = compact ? `+${formatLos(losHours - (expectedLosHours ?? 0))} LOS` : `>${formatLos(losHours)} LOS`;
  } else if (nearThreshold) {
    colourClass = 'bg-amber-100 text-amber-700 border-amber-300';
    label = `~${formatLos(losHours)} LOS`;
  } else {
    colourClass = 'bg-green-100 text-green-700 border-green-300';
    label = formatLos(losHours);
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${colourClass}`}>
      {exceeded && (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      )}
      {label}
    </span>
  );
}
