import { createAction, props } from '@ngrx/store';
import { Shift } from '../models/schedule.models';

// ============================================
// SHIFT ACTIONS
// ============================================

export const loadShifts = createAction(
  '[Shift] Load Shifts',
  props<{ startTime?: string; endTime?: string; targetHours?: number }>()
);

export const loadShiftsSuccess = createAction(
  '[Shift] Load Shifts Success',
  props<{ shifts: Shift[] }>()
);

export const loadShiftsFailure = createAction(
  '[Shift] Load Shifts Failure',
  props<{ error: string }>()
);

