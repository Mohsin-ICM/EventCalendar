import { ScheduleDefinitionPayload } from '../../../scheduling/models/scheduling.models';

export interface CalendarEventEntity {
  id: string;              // UUID
  title: string;
  moduleType: 'CalendarEvent';
  moduleEntityId: string;  // = id (SK routing key)
  color: string;
  createdAt: string;
}

export interface OccurrenceView {
  occurrenceId: string;    // `${eventId}::${startsAt.toISOString()}`
  /** Scheduling service schedule id (from expand) — required for split and overrides. */
  scheduleId: number;
  eventId: string;
  eventTitle: string;
  eventColor: string;
  startsAt: Date;
  endsAt: Date;
  status: 'normal' | 'skipped' | 'moved';
}

export interface OccurrenceOverride {
  type: 'moved';
  originalStartsAt: string;  // ISO
  newStartsAt: string;
  newEndsAt: string;
}

export interface EventFormModalData {
  mode: 'create' | 'edit';
  event?: CalendarEventEntity;
  initialDate?: Date;
  schedule?: ScheduleDefinitionPayload;
}

export interface EventFormResult {
  title: string;
  color: string;
  definition: ScheduleDefinitionPayload;
  eventId?: string;
}

export interface OccurrenceActionModalData {
  occurrence: OccurrenceView;
  event: CalendarEventEntity;
  currentSchedule: ScheduleDefinitionPayload;
}

export type OccurrenceAction =
  | { type: 'skip' }
  | { type: 'move'; newStartsAt: Date; newEndsAt: Date }
  | { type: 'split'; fromDate: Date; newDefinition: ScheduleDefinitionPayload }
  | { type: 'edit-all'; newDefinition: ScheduleDefinitionPayload };

// Palette for event colors
export const EVENT_COLOR_PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];
