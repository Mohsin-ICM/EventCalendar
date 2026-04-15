import type { Schedule } from '../models/schedule.models';
import type { Shift } from '../models/schedule.models';

/** Snapshot of schedule form fields used for RRule generation (matches StaffScheduler behavior). */
export interface ScheduleFormSnapshot {
  frequency: string;
  repeatEvery: string;
  repeatUntil?: string;
  customRepeatInterval?: number | null;
  customEndOption?: string | null;
  customOccurrences?: number | null;
  monthlyRepeatOption?: string | null;
  selectedWeekDays: number[];
  selectedMonthDays: number[];
}

export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function formatDateAsLocalString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateOnlyAsLocalDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = iso.includes('T') ? iso.substring(0, 10) : iso;
  const parts = d.split('-').map(Number);
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function parseTimeToMinutes(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

export function calculateShiftDurationMinutes(
  startTime: string | null | undefined,
  endTime: string | null | undefined
): number {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  const durationMinutes = endMinutes - startMinutes;
  if (durationMinutes > 0) return durationMinutes;
  return durationMinutes + 24 * 60;
}

export function doesTimeRangeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const startAMin = parseTimeToMinutes(startA);
  const endAMinRaw = parseTimeToMinutes(endA);
  const endAMin = endAMinRaw <= startAMin ? endAMinRaw + 24 * 60 : endAMinRaw;
  const startBMin = parseTimeToMinutes(startB);
  const endBMinRaw = parseTimeToMinutes(endB);
  const endBMin = endBMinRaw <= startBMin ? endBMinRaw + 24 * 60 : endBMinRaw;
  return startAMin < endBMin && startBMin < endAMin;
}

/**
 * Expands RRule occurrences within a range (same algorithm as StaffScheduler/calendar expand).
 */
export function expandRRuleOccurrences(
  rRule: string,
  dtStart: Date,
  until: Date | null,
  from: Date,
  to: Date,
  exDates: string[]
): Date[] {
  const occurrences: Date[] = [];
  const rRuleUpper = rRule.toUpperCase();
  const freqMatch = rRuleUpper.match(/FREQ=([A-Z]+)/);
  if (!freqMatch) {
    if (dtStart >= from && dtStart <= to) occurrences.push(new Date(dtStart));
    return occurrences;
  }
  const freq = freqMatch[1];
  const byDayMatch = rRuleUpper.match(/BYDAY=([A-Z0-9,]+)/);
  const byDayList = byDayMatch ? byDayMatch[1].split(',').map((d) => d.trim()) : [];
  const dayNameToDayOfWeek: { [key: string]: number } = {
    SU: 0,
    MO: 1,
    TU: 2,
    WE: 3,
    TH: 4,
    FR: 5,
    SA: 6
  };
  const endDate = until && until < to ? until : to;
  const excludedDates = exDates.map((d) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  });
  const isExcluded = (date: Date): boolean => {
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    return excludedDates.includes(dateOnly.getTime());
  };
  let currentDate = new Date(dtStart);
  let iterations = 0;
  const maxIterations = 10000;

  if (freq === 'WEEKLY' && byDayList.length > 0) {
    const targetDays = byDayList
      .map((day) => {
        const dayName = day.replace(/^\d+/, '');
        return dayNameToDayOfWeek[dayName] !== undefined ? dayNameToDayOfWeek[dayName] : -1;
      })
      .filter((d) => d >= 0);
    let checkDate = new Date(from);
    checkDate.setHours(dtStart.getHours(), dtStart.getMinutes(), dtStart.getSeconds(), dtStart.getMilliseconds());
    if (checkDate < dtStart) checkDate = new Date(dtStart);
    while (checkDate <= endDate && iterations < maxIterations) {
      iterations++;
      const dayOfWeek = checkDate.getDay();
      if (targetDays.includes(dayOfWeek) && !isExcluded(checkDate)) {
        occurrences.push(new Date(checkDate));
      }
      checkDate.setDate(checkDate.getDate() + 1);
    }
  } else {
    while (currentDate <= endDate && iterations < maxIterations) {
      iterations++;
      if (currentDate >= from && currentDate <= endDate && !isExcluded(currentDate)) {
        if (freq === 'DAILY') {
          occurrences.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + 1);
        } else if (freq === 'WEEKLY') {
          occurrences.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + 7);
        } else if (freq === 'MONTHLY') {
          occurrences.push(new Date(currentDate));
          currentDate.setMonth(currentDate.getMonth() + 1);
        } else if (freq === 'YEARLY') {
          occurrences.push(new Date(currentDate));
          currentDate.setFullYear(currentDate.getFullYear() + 1);
        } else {
          if (occurrences.length === 0 && currentDate >= from) occurrences.push(new Date(currentDate));
          break;
        }
      } else {
        if (currentDate < from) {
          if (freq === 'DAILY') {
            currentDate = new Date(from);
            currentDate.setHours(
              dtStart.getHours(),
              dtStart.getMinutes(),
              dtStart.getSeconds(),
              dtStart.getMilliseconds()
            );
          } else if (freq === 'WEEKLY') {
            const daysDiff = Math.floor((from.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
            const weeksToSkip = Math.floor(daysDiff / 7);
            currentDate.setDate(currentDate.getDate() + weeksToSkip * 7);
          } else if (freq === 'MONTHLY') {
            currentDate = new Date(from);
            currentDate.setHours(
              dtStart.getHours(),
              dtStart.getMinutes(),
              dtStart.getSeconds(),
              dtStart.getMilliseconds()
            );
          } else {
            currentDate.setDate(currentDate.getDate() + 1);
          }
        } else {
          break;
        }
      }
    }
  }
  return occurrences;
}

export function expandScheduleDates(schedule: Schedule): string[] {
  const fromStr = schedule.dtStartLocal;
  if (!fromStr) return [];
  const from = new Date(fromStr);
  if (isNaN(from.getTime())) return [];
  const fromDateStr = formatDateAsLocalString(from);
  const normalizedExDates = (schedule.exDate || [])
    .map((date) => (date.includes('T') ? date.substring(0, 10) : date))
    .filter(Boolean);
  const untilStr = schedule.until;
  if (untilStr && untilStr === fromDateStr) {
    return normalizedExDates.includes(fromDateStr) ? [] : [fromDateStr];
  }
  const until = untilStr
    ? parseDateOnlyAsLocalDate(untilStr) ?? new Date(untilStr)
    : (() => {
        const d = new Date(from);
        d.setDate(d.getDate() + 90);
        return d;
      })();
  if (isNaN(until.getTime())) return [fromDateStr];
  from.setHours(0, 0, 0, 0);
  until.setHours(0, 0, 0, 0);
  if (until < from) return [fromDateStr];
  const occurrences = expandRRuleOccurrences(
    schedule.rRule,
    from,
    until,
    from,
    until,
    normalizedExDates
  );
  return occurrences.map((o) => formatDateAsLocalString(o));
}

export function getNewScheduleOccurrenceDates(
  dropDate: Date,
  repeatUntil: string | null | undefined,
  rRule: string
): string[] {
  const start = new Date(dropDate);
  start.setHours(0, 0, 0, 0);
  const startStr = formatDateAsLocalString(start);
  if (!repeatUntil || repeatUntil.trim() === '') return [startStr];
  const until = parseDateOnlyAsLocalDate(repeatUntil) ?? new Date(repeatUntil);
  if (isNaN(until.getTime())) return [startStr];
  until.setHours(0, 0, 0, 0);
  const occurrences = expandRRuleOccurrences(rRule, start, until, start, until, []);
  return occurrences.map((d) => formatDateAsLocalString(d));
}

export function findScheduleConflict(
  schedules: Schedule[],
  shifts: Shift[],
  shiftId: number,
  locationId: number | null | undefined,
  newStartTime: string,
  newEndTime: string,
  newDates: string[]
): { date: string } | null {
  if (!locationId) return null;
  const existingSchedules = (schedules || [])
    .filter((s) => s.shiftId === shiftId)
    .filter((s) => !s.isDeleted)
    .filter((s) => s.active !== false)
    .filter((s) => (s.status || '').toLowerCase() !== 'canceled')
    .filter((s) => (s.status || '').toLowerCase() !== 'cancelled')
    .filter((s) => typeof s.locationId === 'number' && s.locationId === locationId);
  if (existingSchedules.length === 0) return null;
  const newDatesSet = new Set(newDates);
  for (const schedule of existingSchedules) {
    const existingDates = expandScheduleDates(schedule);
    const overlapDate = existingDates.find((d) => newDatesSet.has(d));
    if (!overlapDate) continue;
    const shift = (shifts || []).find((s) => s.id === schedule.shiftId) || null;
    const existingStart = shift?.startTime || newStartTime;
    const existingEnd = shift?.endTime || newEndTime;
    if (doesTimeRangeOverlap(existingStart, existingEnd, newStartTime, newEndTime)) {
      return { date: overlapDate };
    }
  }
  return null;
}

export function resolveScheduleEndDate(formValue: ScheduleFormSnapshot, startDate: Date): string | null {
  if (!formValue?.frequency || formValue.frequency === 'none') {
    return formatDateAsLocalString(startDate);
  }
  const rt = formValue.repeatUntil?.trim();
  return rt ? rt : null;
}

export function convertFrequencyToRRule(
  form: ScheduleFormSnapshot,
  frequency: string,
  repeatEvery: string,
  startDate: Date
): string {
  if (!startDate) return 'FREQ=DAILY;INTERVAL=1';
  if (frequency === 'none') return 'FREQ=DAILY;COUNT=1';

  const dayOfWeek = startDate.getDay();
  const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const dayName = dayNames[dayOfWeek];
  const dayOfMonth = startDate.getDate();
  const customInterval = Number(form.customRepeatInterval) || 1;

  if (frequency === 'daily') {
    if (repeatEvery === 'day') return `FREQ=DAILY;INTERVAL=${customInterval}`;
    if (repeatEvery === 'week') return 'FREQ=DAILY;INTERVAL=7';
    if (repeatEvery === 'month') return `FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth};INTERVAL=1`;
  } else if (frequency === 'weekdays') {
    return `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;INTERVAL=${customInterval}`;
  } else if (frequency === 'weekly') {
    const selectedWeekDays = form.selectedWeekDays || [];
    const dayNamesMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    if (repeatEvery === 'day') return `FREQ=WEEKLY;BYDAY=${dayName};INTERVAL=1`;
    if (repeatEvery === 'week') {
      if (selectedWeekDays.length > 0) {
        const selectedDayNames = selectedWeekDays.map((d: number) => dayNamesMap[d]).join(',');
        return `FREQ=WEEKLY;BYDAY=${selectedDayNames};INTERVAL=${customInterval}`;
      }
      return `FREQ=WEEKLY;BYDAY=${dayName};INTERVAL=${customInterval}`;
    }
    if (repeatEvery === 'month') {
      if (selectedWeekDays.length > 0) {
        const selectedDayNames = selectedWeekDays.map((d: number) => dayNamesMap[d]).join(',');
        return `FREQ=WEEKLY;BYDAY=${selectedDayNames};INTERVAL=4`;
      }
      return `FREQ=WEEKLY;BYDAY=${dayName};INTERVAL=4`;
    }
  } else if (frequency === 'monthly') {
    const selectedMonthDays = form.selectedMonthDays || [];
    const monthlyRepeatOption = form.monthlyRepeatOption || null;
    if (repeatEvery === 'day') return `FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth};INTERVAL=1`;
    if (repeatEvery === 'month') {
      const customWeekdayMatch =
        typeof monthlyRepeatOption === 'string' ? monthlyRepeatOption.match(/^weekday-(\d+)-(\d+)$/) : null;
      if (customWeekdayMatch) {
        const occurrence = parseInt(customWeekdayMatch[1], 10);
        const weekdayIndex = parseInt(customWeekdayMatch[2], 10);
        const weekdayName = dayNames[weekdayIndex] || dayName;
        return `FREQ=MONTHLY;BYDAY=${occurrence}${weekdayName};INTERVAL=${customInterval}`;
      }
      const customDayMatch =
        typeof monthlyRepeatOption === 'string' ? monthlyRepeatOption.match(/^day-(\d+)$/) : null;
      if (customDayMatch) {
        const customDay = parseInt(customDayMatch[1], 10);
        return `FREQ=MONTHLY;BYMONTHDAY=${customDay};INTERVAL=${customInterval}`;
      }
      if (selectedMonthDays.length > 0) {
        const daysStr = selectedMonthDays.join(',');
        return `FREQ=MONTHLY;BYMONTHDAY=${daysStr};INTERVAL=${customInterval}`;
      }
      return `FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth};INTERVAL=${customInterval}`;
    }
    if (repeatEvery === 'week') {
      let occurrence = 0;
      for (let day = 1; day <= dayOfMonth; day++) {
        const testDate = new Date(startDate.getFullYear(), startDate.getMonth(), day);
        if (testDate.getDay() === dayOfWeek) occurrence++;
      }
      const lastDayOfMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
      let isLast = true;
      for (let day = dayOfMonth + 1; day <= lastDayOfMonth; day++) {
        const testDate = new Date(startDate.getFullYear(), startDate.getMonth(), day);
        if (testDate.getDay() === dayOfWeek) {
          isLast = false;
          break;
        }
      }
      if (isLast) return `FREQ=MONTHLY;BYDAY=-1${dayName};INTERVAL=1`;
      return `FREQ=MONTHLY;BYDAY=${occurrence}${dayName};INTERVAL=1`;
    }
  } else if (frequency === 'annually') {
    const monthOfYear = startDate.getMonth() + 1;
    return `FREQ=YEARLY;BYMONTH=${monthOfYear};BYMONTHDAY=${dayOfMonth};INTERVAL=${customInterval}`;
  }
  return 'FREQ=DAILY;INTERVAL=1';
}

export function setRepeatEveryForFrequency(
  frequency: string | null | undefined
): string {
  if (frequency === 'weekly' || frequency === 'weekdays') return 'week';
  if (frequency === 'monthly') return 'month';
  if (frequency === 'annually') return 'day';
  return 'day';
}
