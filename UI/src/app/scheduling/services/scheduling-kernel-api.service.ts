import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ScheduleDefinitionPayload,
  ExpandByDefinitionRequest,
  ExpandByReferenceRequest,
  ExpandResponse,
  ValidateResponse
} from '../models/scheduling.models';

@Injectable({ providedIn: 'root' })
export class SchedulingKernelApiService {
  private readonly baseUrl = `${environment.schedulingKernelUrl}/api/v1/schedules`;

  constructor(private http: HttpClient) {}

  upsertSchedule(
    moduleType: string,
    moduleEntityId: string,
    payload: ScheduleDefinitionPayload
  ): Observable<void> {
    return this.http.put<void>(
      `${this.baseUrl}/${encodeURIComponent(moduleType)}/${encodeURIComponent(moduleEntityId)}`,
      payload
    );
  }

  getSchedule(moduleType: string, moduleEntityId: string): Observable<ScheduleDefinitionPayload> {
    return this.http.get<ScheduleDefinitionPayload>(
      `${this.baseUrl}/${encodeURIComponent(moduleType)}/${encodeURIComponent(moduleEntityId)}`
    );
  }

  deleteSchedule(moduleType: string, moduleEntityId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${encodeURIComponent(moduleType)}/${encodeURIComponent(moduleEntityId)}`
    );
  }

  validate(payload: ScheduleDefinitionPayload): Observable<ValidateResponse> {
    return this.http.post<ValidateResponse>(`${this.baseUrl}/validate`, payload);
  }

  expandByDefinition(request: ExpandByDefinitionRequest): Observable<ExpandResponse> {
    return this.http.post<ExpandResponse>(`${this.baseUrl}/expand-by-definition`, request);
  }

  expandByReference(request: ExpandByReferenceRequest): Observable<ExpandResponse> {
    return this.http.post<ExpandResponse>(`${this.baseUrl}/expand-by-reference`, request);
  }
}
