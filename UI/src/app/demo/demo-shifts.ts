import { Shift } from '../models/schedule.models';

/** Stable id so we avoid colliding with typical API ids. */
const DEMO_SHIFT_ID = 900001;

/**
 * Local-only shift for dragging onto the calendar to test frequency / recurrence
 * without depending on API-seeded shifts.
 */
export function getDemoShifts(): Shift[] {
  const now = new Date().toISOString();
  return [
    {
      id: DEMO_SHIFT_ID,
      tenantId: 1,
      name: 'Demo – Morning (frequency test)',
      locationId: null,
      notes: 'Drag this to a day to test recurrence / frequency.',
      targetHours: 8,
      startTime: '09:00:00',
      endTime: '17:00:00',
      clonedFromShiftId: null,
      version: 1,
      createdOn: now,
      createdBy: 0,
      updatedOn: now,
      updatedBy: 0
    }
  ];
}

/**
 * Appends demo shifts when `include` is true; skips ids already present from the API.
 */
export function mergeDemoShifts(remote: Shift[] | null | undefined, include: boolean): Shift[] {
  if (!include) {
    return remote ? [...remote] : [];
  }
  const list = remote ? [...remote] : [];
  const existingIds = new Set(list.map((s) => s.id));
  for (const d of getDemoShifts()) {
    if (!existingIds.has(d.id)) {
      list.push(d);
      existingIds.add(d.id);
    }
  }
  return list;
}
