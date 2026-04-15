import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ScheduleState } from './schedule.reducer';
import { Shift, Schedule } from '../models/schedule.models';

/**
 * Selects the schedule feature state.
 */
export const selectScheduleState = createFeatureSelector<ScheduleState>('schedules');

/**
 * Selects all shifts.
 */
export const selectShifts = createSelector(
  selectScheduleState,
  (state: ScheduleState | undefined): Shift[] => {
    if (!state) return [];
    return state.shifts || [];
  }
);

/**
 * @deprecated Use selectSchedulesForShift(shiftId) instead
 */
export const selectSchedules = createSelector(
  selectScheduleState,
  (state: ScheduleState | undefined): Schedule[] => {
    if (!state || !state.schedules) return [];
    // Flatten all schedules from all shifts
    return Object.values(state.schedules).flat();
  }
);

