import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ScheduleDefinitionPayload } from '../../../scheduling/models/scheduling.models';
import {
  CalendarEventEntity,
  OccurrenceView,
  EVENT_COLOR_PALETTE
} from '../models/event-calendar.models';

interface EventListItemApi {
  id: string;
  title: string;
  color: string;
}

interface EventDetailsApi {
  id: string;
  title: string;
  description?: string;
  color: string;
  moduleType: string;
  moduleEntityId: string;
  createdAtUtc?: string;
  schedule?: ScheduleDefinitionPayload;
}

interface OccurrenceApi {
  eventId: string;
  eventTitle: string;
  eventColor: string;
  startUtc: string;
  endUtc: string;
}

interface ExpandEnvelopeApi {
  occurrences: OccurrenceApi[];
  nextCursor?: string;
}

@Injectable({ providedIn: 'root' })
export class EventCalendarService {
  readonly events = signal<CalendarEventEntity[]>([]);
  private scheduleCache = new Map<string, ScheduleDefinitionPayload>();
  private readonly baseUrl = `${environment.eventCalendarApiUrl}/v1/events`;

  constructor(private http: HttpClient) {}

  createEvent(
    title: string,
    color: string,
    definition: ScheduleDefinitionPayload
  ): Observable<CalendarEventEntity> {
    return this.http.post<EventDetailsApi>(this.baseUrl, {
      title,
      color,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      schedule: definition
    }).pipe(
      map(api => this.mapEventEntity(api)),
      tap(entity => {
        this.events.update(list => [...list, entity]);
        this.scheduleCache.set(entity.id, definition);
      })
    );
  }

  updateEvent(eventId: string, title: string, color: string): void {
    this.events.update(list =>
      list.map(e => e.id === eventId ? { ...e, title, color } : e)
    );
  }

  updateEventSchedule(eventId: string, definition: ScheduleDefinitionPayload): Observable<void> {
    const event = this.events().find(e => e.id === eventId);
    if (!event) return of(undefined as void);

    return this.http.put<EventDetailsApi>(`${this.baseUrl}/${eventId}`, {
      title: event.title,
      color: event.color,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      schedule: definition
    }).pipe(
      tap(() => this.scheduleCache.set(eventId, definition)),
      map(() => undefined)
    );
  }

  deleteEvent(eventId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${eventId}`).pipe(
      tap(() => {
        this.events.update(list => list.filter(e => e.id !== eventId));
        this.scheduleCache.delete(eventId);
      }),
      map(() => undefined)
    );
  }

  getScheduleForEvent(eventId: string): ScheduleDefinitionPayload | null {
    return this.scheduleCache.get(eventId) ?? null;
  }

  ensureScheduleLoaded(eventId: string): Observable<ScheduleDefinitionPayload | null> {
    const cached = this.scheduleCache.get(eventId);
    if (cached) return of(cached);

    return this.http.get<EventDetailsApi>(`${this.baseUrl}/${eventId}`).pipe(
      map(api => {
        const schedule = api.schedule ?? null;
        if (schedule) this.scheduleCache.set(eventId, schedule);
        return schedule;
      }),
      catchError(() => of(null))
    );
  }

  getOccurrencesForRange(from: Date, to: Date): Observable<OccurrenceView[]> {
    return this.http.get<EventListItemApi[]>(this.baseUrl).pipe(
      tap(items => {
        this.events.set(items.map(item => ({
          id: item.id,
          title: item.title,
          color: item.color,
          moduleType: 'CalendarEvent',
          moduleEntityId: item.id,
          createdAt: new Date().toISOString()
        })));
      }),
      switchMap(items => {
        if (items.length === 0) return of([] as OccurrenceView[]);

        const calls = items.map(item =>
          this.http.post<ExpandEnvelopeApi>(`${this.baseUrl}/${item.id}/occurrences/expand`, {
            rangeStartUtc: from.toISOString(),
            rangeEndUtc: to.toISOString(),
            maxOccurrences: 500,
            pageSize: 500
          }).pipe(
            map(res => (res.occurrences || []).map(occ => ({
              occurrenceId: `${item.id}::${occ.startUtc}`,
              eventId: item.id,
              eventTitle: occ.eventTitle || item.title,
              eventColor: occ.eventColor || item.color,
              startsAt: new Date(occ.startUtc),
              endsAt: new Date(occ.endUtc),
              status: 'normal' as const
            }))),
            catchError(() => of([] as OccurrenceView[]))
          )
        );

        return forkJoin(calls).pipe(
          map(groups =>
            groups
              .flat()
              .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
          )
        );
      }),
      catchError(() => of([]))
    );
  }

  skipOccurrence(eventId: string, occurrenceStart: Date): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${eventId}/occurrences/overrides`, {
      targetOccurrenceStartUtc: occurrenceStart.toISOString(),
      action: 'Skip'
    }).pipe(map(() => undefined));
  }

  moveOccurrence(eventId: string, originalStart: Date, newStart: Date, newEnd: Date): void {
    this.http.post<void>(`${this.baseUrl}/${eventId}/occurrences/overrides`, {
      targetOccurrenceStartUtc: originalStart.toISOString(),
      action: 'Move',
      movedStartUtc: newStart.toISOString(),
      movedEndUtc: newEnd.toISOString()
    }).subscribe();
  }

  splitSchedule(
    eventId: string,
    fromDate: Date,
    newDefinition: ScheduleDefinitionPayload
  ): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${eventId}/schedule/split`, {
      splitStartUtc: fromDate.toISOString(),
      newDefinition
    }).pipe(map(() => undefined));
  }

  editAllOccurrences(eventId: string, newDefinition: ScheduleDefinitionPayload): Observable<void> {
    return this.updateEventSchedule(eventId, newDefinition);
  }

  private mapEventEntity(api: EventDetailsApi): CalendarEventEntity {
    return {
      id: api.id,
      title: api.title,
      moduleType: 'CalendarEvent',
      moduleEntityId: api.moduleEntityId || api.id,
      color: api.color || EVENT_COLOR_PALETTE[0],
      createdAt: api.createdAtUtc || new Date().toISOString()
    };
  }
}
