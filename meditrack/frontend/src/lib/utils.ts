/**
 * MediTrack CDSS - Utility Functions
 */
import type { CdssSeverity } from '@/types';

/** Format a number of hours into a human-readable string: "3d 4h" */
export function formatLos(losHours: number): string {
  const days = Math.floor(losHours / 24);
  const hours = Math.floor(losHours % 24);
  if (days === 0) return `${hours}h`;
  if (hours === 0) return `${days}d`;
  return `${days}d ${hours}h`;
}

/** Format an ISO date string as a locale-aware date string */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Format an ISO date-time string as a locale-aware date + time */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Map a CDSS severity to a Tailwind background colour class */
export function severityBg(severity: CdssSeverity): string {
  switch (severity) {
    case 'critical':     return 'bg-red-100 border-red-400 text-red-900';
    case 'warning':      return 'bg-amber-100 border-amber-400 text-amber-900';
    case 'informational': return 'bg-blue-100 border-blue-400 text-blue-900';
  }
}

/** Map a CDSS severity to a badge colour class */
export function severityBadge(severity: CdssSeverity): string {
  switch (severity) {
    case 'critical':     return 'bg-red-500 text-white';
    case 'warning':      return 'bg-amber-500 text-white';
    case 'informational': return 'bg-blue-500 text-white';
  }
}

/** Calculate age from a date-of-birth ISO string */
export function calculateAge(dob: string): number {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/** Capitalise first letter of each word */
export function titleCase(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
