import { createReducer, on } from '@ngrx/store';
import * as ScheduleActions from './schedule.actions';
import { Shift, Schedule, Instance } from '../models/schedule.models';

/**
 * Schedule state interface.
 */
export interface ScheduleState {
  shifts: Shift[];
  schedules: Record<number, Schedule[]>; // Keyed by shiftId
  instances: Instance[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Initial schedule state.
 */
export const initialState: ScheduleState = {
  shifts: [],
  schedules: {},
  instances: [],
  isLoading: false,
  error: null
};

/**
 * Schedule reducer.
 * Handles schedule state changes.
 */
export const scheduleReducer = createReducer(
  initialState,
  
  // Load Shifts
  on(ScheduleActions.loadShifts, (state) => ({
    ...state,
    isLoading: true,
    error: null
  })),
  on(ScheduleActions.loadShiftsSuccess, (state, { shifts }) => {
    return {
      ...state,
      shifts: shifts || [],
      isLoading: false,
      error: null
    };
  }),
  on(ScheduleActions.loadShiftsFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error: error || null
  }))
);

