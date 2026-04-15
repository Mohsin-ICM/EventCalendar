// Scheduling Kernel Service — canonical API contracts
// Per spec: spec_1_scheduling_kernel_service.md

export interface ScheduleDefinitionPayload {
  evaluatorType: 'Rfc5545';
  rrule: string;           // e.g. "FREQ=WEEKLY;BYDAY=MO,WE;INTERVAL=1"
  rdate?: string;          // comma-separated ISO local datetimes
  exdate?: string;         // comma-separated ISO local datetimes
  dtstart: string;         // ISO local: "2026-04-07T09:00:00"
  timezone: string;        // IANA: "America/New_York"
  durationSeconds?: number;
  isActive?: boolean;
}

export interface ExpandByDefinitionRequest {
  schedule: ScheduleDefinitionPayload;
  rangeStartUtc: string;   // ISO UTC
  rangeEndUtc: string;     // ISO UTC
  maxOccurrences?: number;
  pageSize?: number;
  cursor?: string | null;
  appliedPolicyIds?: string[];
}

export interface ExpandByReferenceRequest {
  moduleType: string;
  moduleEntityId: string;
  rangeStartUtc: string;
  rangeEndUtc: string;
  maxOccurrences?: number;
  pageSize?: number;
  cursor?: string | null;
  appliedPolicyIds?: string[];
}

export interface ExpandedOccurrence {
  moduleType: string;
  moduleEntityId: string;
  startUtc: string;
  endUtc: string;
}

export interface ExpandResponse {
  occurrences: ExpandedOccurrence[];
  nextCursor?: string;
}

export interface ValidateResponse {
  isValid: boolean;
  errors?: string[];
}

export interface UpsertScheduleRequest extends ScheduleDefinitionPayload {}
