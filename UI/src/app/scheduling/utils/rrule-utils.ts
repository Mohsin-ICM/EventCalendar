/**
 * Shared utilities for rrule ↔ wall-clock date conversions.
 * All occurrence math MUST go through rrule.js — never custom recurrence logic.
 */

/** Converts ISO local "YYYY-MM-DDTHH:mm:ss" → compact rrule DTSTART "YYYYMMDDTHHmmssZ"
 *  (wall-clock trick: append 'Z' so the UTC numeric fields equal the local wall-clock values) */
export function toRRuleDtstart(dtstart: string): string {
  const d = new Date(dtstart + 'Z');
  const p = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}00Z`;
}

/** Converts a Date whose *UTC fields* hold wall-clock values back to "YYYY-MM-DDTHH:mm:ss" */
export function toISOLocal(d: Date): string {
  const p = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${p(d.getUTCFullYear(), 4)}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00`;
}

/** Human-readable label for an occurrence Date (wall-clock via UTC fields) */
export function formatOccurrenceDate(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  }).format(new Date(Date.UTC(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes()
  )));
}
