/**
 * Schedule-related models and interfaces.
 * Matches backend DTOs for type safety.
 */

/**
 * Shift model - matches backend ShiftDto.
 */
export interface Shift {
  id: number;
  tenantId: number;
  name: string;
  locationId?: number | null;
  notes?: string | null;
  targetHours?: number | null; // decimal? in backend, number | null in TS
  startTime?: string | null; // TimeOnly? in backend, string | null in TS (format: "HH:mm:ss")
  endTime?: string | null; // TimeOnly? in backend, string | null in TS (format: "HH:mm:ss")
  clonedFromShiftId?: number | null;
  version: number;
  createdOn: string; // DateTimeOffset in backend, string in TS
  createdBy: number;
  updatedOn: string; // DateTimeOffset in backend, string in TS
  updatedBy: number;
}

/**
 * Schedule model - matches backend ScheduleDto (from ScheduleController).
 */
export interface Schedule {
  id: number;
  shiftId: number;
  locationId?: number | null;
  timezone: string;
  targetHours?: number | null;
  dtStartLocal: string; // DateTime in backend, ISO string in TS
  durationMinutes: number;
  rRule: string;
  exDate: string[]; // DateOnly[] in backend, string[] in TS (format: "YYYY-MM-DD")
  until?: string | null; // DateOnly? in backend, string | null in TS (format: "YYYY-MM-DD")
  active: boolean;
  isDeleted?: boolean;
  status: string; // 'draft' or 'published'
  parentScheduleId?: number | null; // For tracking override schedules
  overrideSourceDate?: string | null; // DateOnly? in backend, string | null in TS (format: "YYYY-MM-DD")
  createdOn: string; // DateTimeOffset in backend, string in TS
  createdBy: number;
  updatedOn: string; // DateTimeOffset in backend, string in TS
  updatedBy: number;
}

/**
 * Create Schedule Request - matches backend CreateScheduleDto.
 */
export interface CreateScheduleRequest {
  locationId?: number | null;
  timezone: string;
  targetHours?: number | null;
  dtStartLocal: string;
  durationMinutes: number;
  rRule: string;
  exDate?: string[];
  until?: string | null;
}

/**
 * Update Schedule Request - matches backend UpdateScheduleDto.
 */
export interface UpdateScheduleRequest {
  locationId?: number | null;
  timezone?: string | null;
  targetHours?: number | null;
  dtStartLocal?: string | null;
  durationMinutes?: number | null;
  rRule?: string | null;
  exDate?: string[] | null;
  until?: string | null;
  active?: boolean | null;
  isDeleted?: boolean | null;
  selectedDates?: string[] | null;
  selectedOccurrenceDate?: string | null;
  applyToPatternDay?: boolean;
  patternDayDate?: string | null;
}

/** Edit scope for creating a draft from a published schedule. */
export enum EditScope {
  ThisOccurrenceOnly = 1,
  ThisAndAllFuture = 2,
  AllOccurrences = 3
}

export interface CreateDraftFromPublishedRequest {
  scope: EditScope;
  targetDate?: string | null;
  timezone?: string | null;
  dtStartLocal?: string | null;
  durationMinutes?: number | null;
  rRule?: string | null;
  until?: string | null;
  targetHours?: number | null;
  locationId?: number | null;
}

export interface CreateDraftFromPublishedResult {
  draftScheduleId: number;
  originalScheduleId: number;
  message: string;
}

export interface PublishDraftRequest {
  applyToInstanceOnly: boolean;
  originalInstanceId?: number | null;
  originalInstanceDate?: string | null;
  originalScheduleId?: number | null;
  selectedDates?: string[] | null;
  applyToPatternDay?: boolean;
}

export interface PublishDraftResult {
  instancesCreated: number;
  instancesCanceled: number;
  instancesUpdated: number;
  publishedScheduleId: number;
  message: string;
}

export interface PublishOccurrenceRequest {
  originalInstanceId?: number | null;
  originalInstanceDate?: string | null;
}

/**
 * Instance model - matches backend InstanceDto.
 */
export interface Instance {
  id: number;
  shiftId: number;
  scheduleId: number;
  startsAt: string; // DateTimeOffset in backend, ISO string in TS
  endsAt: string; // DateTimeOffset in backend, ISO string in TS
  locationId?: number | null;
  state: string; // "Published", "Overridden", "Canceled", etc.
  overrideOf?: number | null;
  assignees: Assignee[];
  notes?: string | null;
}

/**
 * Assignee model - matches backend AssigneeDto.
 */
export interface Assignee {
  staffId: number;
  startsAt: string; // DateTimeOffset in backend, ISO string in TS
  endsAt: string; // DateTimeOffset in backend, ISO string in TS
  addedBy?: number | null;
  addedAt: string; // DateTimeOffset in backend, ISO string in TS
}

/**
 * Assignment Rule Type enum - matches backend AssignmentRuleType.
 */
export enum AssignmentRuleType {
  Direct = 0,
  RoleEligible = 1
}

/**
 * Assignment Rule - matches backend AssignmentRuleDto.
 */
export interface AssignmentRule {
  id: number;
  shiftId: number;
  scheduleId?: number | null; // Schedule ID that created this rule
  type: string; // "Direct" or "RoleEligible"
  staffId?: number | null;
  roleId?: number | null;
  startTime?: string | null; // TimeOnly format: "HH:mm:ss" or "HH:mm"
  endTime?: string | null; // TimeOnly format: "HH:mm:ss" or "HH:mm"
  effectiveFrom: string; // DateOnly format: "YYYY-MM-DD"
  effectiveTo?: string | null; // DateOnly format: "YYYY-MM-DD"
  notes?: string | null;
  status?: string; // "draft" or "published"
  clonedFromRuleId?: number | null; // ID of the original rule if this is a draft copy
  isDeleted?: boolean;
}

/**
 * Create Assignment Rule Request - matches backend CreateAssignmentRuleDto.
 */
export interface CreateAssignmentRuleRequest {
  type: AssignmentRuleType;
  staffId?: number | null;
  roleId?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
  scheduleId?: number | null;
  clonedFromRuleId?: number | null;
}

/**
 * Update Assignment Rule Request - matches backend UpdateAssignmentRuleDto.
 */
export interface UpdateAssignmentRuleRequest {
  startTime?: string | null;
  endTime?: string | null;
  effectiveTo?: string | null;
  notes?: string | null;
}

export interface PublishDraftAssignmentRulesRequest {
  scheduleId: number;
  applyToInstanceOnly: boolean;
  sourceInstanceDate?: string | null;
  draftRuleIds?: number[] | null;
}

export interface PublishDraftAssignmentRulesResult {
  rulesPublished: number;
  assigneesCreated: number;
  assigneesUpdated: number;
  publishedRuleIds: number[];
  message: string;
}

/**
 * Update Assignees Request - matches backend UpdateAssigneesRequestDto.
 */
export interface UpdateAssigneesRequest {
  staffIds: number[];
}

/**
 * Calendar event view model for UI display.
 */
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource?: {
    assigneeId?: string;
    assigneeDisplayName?: string;
    roleKey?: string;
    location?: string;
    shiftId?: number;
    shiftName?: string;
    scheduleId?: number; // Schedule ID (for schedule-based events)
    instanceId?: number; // Instance ID (for published instances)
    assignmentRuleId?: number; // Assignment rule ID (for rule-based events)
    assignees?: Assignee[]; // Array of assignees with details
    totalAssignedHours?: number; // Total assigned hours for the instance
    requiredHours?: number;
    assignedHours?: number;
    assignedStaffCount?: number;
    status?: string;
    draftOverridePending?: boolean;
    draftAssignmentPending?: boolean;
  };
  color?: string;
  originalStart?: Date;
  originalEnd?: Date;
  targetHours?: number;
  assignedHours?: number;
}

