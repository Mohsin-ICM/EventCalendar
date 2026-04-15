import { Pipe, PipeTransform } from '@angular/core';

export type IcmDateTimeFormat =
  | 'dateTime'
  | 'dateOnly'
  | 'timeOnly'
  | 'dateTimeWithDescription';

function coerceDate(input: Date | string | number | null | undefined): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return Number.isFinite(input.getTime()) ? input : null;
  if (typeof input === 'number') {
    const d = new Date(input);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  const raw = String(input).trim();
  if (!raw) return null;

  // DateOnly: "YYYY-MM-DD" -> treat as local date (avoid timezone shifting).
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const y = Number(dateOnly[1]);
    const m = Number(dateOnly[2]);
    const d = Number(dateOnly[3]);
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      const local = new Date(y, m - 1, d);
      return Number.isFinite(local.getTime()) ? local : null;
    }
  }

  // Normalize common backend formats:
  // - "YYYY-MM-DD HH:mm:ss.SSS+05"  -> "YYYY-MM-DDTHH:mm:ss.SSS+05:00"
  // - "YYYY-MM-DD HH:mm:ss+05:00"  -> "YYYY-MM-DDTHH:mm:ss+05:00"
  let normalized = raw.replace(' ', 'T');
  normalized = normalized.replace(/([+-]\d{2})$/, '$1:00');

  const d = new Date(normalized);
  return Number.isFinite(d.getTime()) ? d : null;
}

type DateTimeParts = { date: string; time: string; tz: string };

function formatParts(d: Date, timeZone?: string): DateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
    ...(timeZone ? { timeZone } : {})
  });

  const parts = formatter.formatToParts(d);

  const month = parts.find(p => p.type === 'month')?.value ?? '';
  const day = parts.find(p => p.type === 'day')?.value ?? '';
  const year = parts.find(p => p.type === 'year')?.value ?? '';
  const hour = parts.find(p => p.type === 'hour')?.value ?? '';
  const minute = parts.find(p => p.type === 'minute')?.value ?? '';
  const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value ?? '';
  const tzName = parts.find(p => p.type === 'timeZoneName')?.value ?? '';

  const date = `${month}/${day}/${year}`;
  const time = `${hour}:${minute} ${dayPeriod}`.trim();
  const tz = tzName;

  return { date, time, tz };
}

@Pipe({
  name: 'icmDateTime',
  standalone: true
})
export class IcmDateTimePipe implements PipeTransform {
  transform(
    value: Date | string | number | null | undefined,
    format: IcmDateTimeFormat = 'dateTime',
    updatedBy?: string | null,
    timeZone?: string | null
  ): string {
    const d = coerceDate(value);
    if (!d) return '';

    const { date, time, tz } = formatParts(d, timeZone ?? undefined);

    if (format === 'dateOnly') return date;
    if (format === 'timeOnly') return `${time}${tz ? ` ${tz}` : ''}`.trim();

    const dateTime = `${date} ${time}${tz ? ` ${tz}` : ''}`.trim();
    if (format === 'dateTime') return dateTime;

    const who = (updatedBy || '').trim();
    if (!who) return `Last updated on: ${dateTime}`;
    return `Last updated by: ${who} on ${dateTime}`;
  }
}
