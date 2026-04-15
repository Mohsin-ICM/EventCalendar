import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Shift,
  Schedule,
  Instance,
  AssignmentRule,
  UpdateAssigneesRequest,
  Assignee,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  CreateAssignmentRuleRequest,
  UpdateAssignmentRuleRequest,
  CreateDraftFromPublishedRequest,
  CreateDraftFromPublishedResult,
  PublishDraftRequest,
  PublishDraftResult,
  PublishOccurrenceRequest,
  PublishDraftAssignmentRulesRequest,
  PublishDraftAssignmentRulesResult
} from '../models/schedule.models';

/**
 * Schedule API — aligned with StaffScheduler `core/services/schedule.service.ts` endpoints.
 */
@Injectable({
  providedIn: 'root'
})
export class ScheduleService {
  private readonly baseUrl = `${environment.apiUrl}/api/v1`;

  constructor(private http: HttpClient) {}

  getAllShifts(): Observable<Shift[]> {
    return this.http.get<Shift[]>(`${this.baseUrl}/shifts/all`);
  }

  getSchedulesForShift(shiftId: number): Observable<Schedule[]> {
    const params = new HttpParams().set('shiftId', shiftId.toString());
    return this.http.get<Schedule[]>(`${this.baseUrl}/schedules`, { params });
  }

  getScheduleById(scheduleId: number): Observable<Schedule> {
    return this.http.get<Schedule>(`${this.baseUrl}/schedules/${scheduleId}`);
  }

  getSchedules(from: string, to: string, state?: string, shiftId?: number): Observable<Schedule[]> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (state) params = params.set('state', state);
    if (shiftId) params = params.set('shiftId', shiftId.toString());
    return this.http.get<Schedule[]>(`${this.baseUrl}/schedules`, { params });
  }

  createSchedule(shiftId: number, request: CreateScheduleRequest): Observable<Schedule> {
    return this.http.post<Schedule>(`${this.baseUrl}/shifts/${shiftId}/schedules`, request);
  }

  updateSchedule(shiftId: number, scheduleId: number, request: UpdateScheduleRequest): Observable<Schedule> {
    return this.http.patch<Schedule>(`${this.baseUrl}/shifts/${shiftId}/schedules/${scheduleId}`, request);
  }

  createDraftFromPublished(
    scheduleId: number,
    request: CreateDraftFromPublishedRequest
  ): Observable<CreateDraftFromPublishedResult> {
    return this.http.post<CreateDraftFromPublishedResult>(
      `${this.baseUrl}/schedules/${scheduleId}/create-draft-from-published`,
      request
    );
  }

  publishDraftSchedule(scheduleId: number, request: PublishDraftRequest): Observable<PublishDraftResult> {
    return this.http.post<PublishDraftResult>(`${this.baseUrl}/schedules/${scheduleId}/publish-draft`, request);
  }

  publishOccurrence(scheduleId: number, request: PublishOccurrenceRequest): Observable<PublishDraftResult> {
    return this.http.post<PublishDraftResult>(`${this.baseUrl}/schedules/${scheduleId}/publish-occurrence`, request);
  }

  getAssignmentRules(shiftId: number): Observable<AssignmentRule[]> {
    return this.http.get<AssignmentRule[]>(`${this.baseUrl}/shifts/${shiftId}/rules`);
  }

  createAssignmentRule(shiftId: number, request: CreateAssignmentRuleRequest): Observable<AssignmentRule> {
    return this.http.post<AssignmentRule>(`${this.baseUrl}/shifts/${shiftId}/rules`, request);
  }

  updateAssignmentRule(shiftId: number, ruleId: number, request: UpdateAssignmentRuleRequest): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/shifts/${shiftId}/rules/${ruleId}`, request);
  }

  deleteAssignmentRule(shiftId: number, ruleId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/shifts/${shiftId}/rules/${ruleId}`);
  }

  publishDraftAssignmentRules(
    shiftId: number,
    request: PublishDraftAssignmentRulesRequest
  ): Observable<PublishDraftAssignmentRulesResult> {
    return this.http.post<PublishDraftAssignmentRulesResult>(
      `${this.baseUrl}/shifts/${shiftId}/rules/publish-draft`,
      request
    );
  }

  getInstances(
    start: string,
    end: string,
    staffId?: number,
    locationId?: number,
    publishedOnly: boolean = false
  ): Observable<Instance[]> {
    let params = new HttpParams()
      .set('start', start)
      .set('end', end)
      .set('publishedOnly', publishedOnly.toString());
    if (staffId) params = params.set('staffId', staffId.toString());
    if (locationId) params = params.set('locationId', locationId.toString());
    return this.http.get<Instance[]>(`${this.baseUrl}/instances`, { params });
  }

  addAssignees(instanceId: number, request: UpdateAssigneesRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/instances/${instanceId}/assignees`, request);
  }

  removeAssignees(instanceId: number, request: UpdateAssigneesRequest): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/instances/${instanceId}/assignees`, { body: request });
  }

  getEffectiveAssignmentRules(shiftId: number, date: string): Observable<AssignmentRule[]> {
    return this.http.get<AssignmentRule[]>(`${this.baseUrl}/shifts/${shiftId}/rules/effective`, {
      params: { date }
    });
  }

  getResolvedAssignees(shiftId: number, date: string): Observable<Assignee[]> {
    return this.http.get<Assignee[]>(`${this.baseUrl}/shifts/${shiftId}/assignees`, { params: { date } });
  }
}
