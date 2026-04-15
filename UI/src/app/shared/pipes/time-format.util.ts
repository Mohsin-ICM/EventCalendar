export type TimeDisplayFormat = '12h' | '24h';

type ParsedTime = { hours: number; minutes: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseTimeString(input: string): ParsedTime | null {
  const clean = (input || '').trim();
  if (!clean) return null;

  // 12-hour format: "9:00 AM", "09:00PM"
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toUpperCase();
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;

    hours = hours % 12;
    if (period === 'PM') hours += 12;

    return { hours, minutes };
  }

  // 24-hour format: "09:00", "09:00:00", "9:00"
  const match24 = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match24) return null;

  const hours = parseInt(match24[1], 10);
  const minutes = parseInt(match24[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return { hours, minutes };
}

export function formatTimeString(
  time: string | null | undefined,
  format: TimeDisplayFormat = '12h'
): string {
  if (!time) return '';
  const parsed = parseTimeString(time);
  if (!parsed) return (time || '').toString();

  const hours24 = clamp(parsed.hours, 0, 23);
  const minutes = clamp(parsed.minutes, 0, 59);
  const minutesStr = minutes.toString().padStart(2, '0');

  if (format === '24h') {
    return `${hours24.toString().padStart(2, '0')}:${minutesStr}`;
  }

  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutesStr} ${period}`;
}

