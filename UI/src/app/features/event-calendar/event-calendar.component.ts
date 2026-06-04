import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { CalendarEvent } from '../../models/schedule.models';
import { SharedCalendarComponent } from '../../shared/components/calendar/shared-calendar.component';
import { EventCalendarService } from './services/event-calendar.service';
import {
  EventFormModalData,
  EventFormResult,
  OccurrenceAction,
  OccurrenceActionModalData,
  OccurrenceView
} from './models/event-calendar.models';
import { EventFormModalComponent } from './components/event-form-modal/event-form-modal.component';
import { OccurrenceActionModalComponent } from './components/occurrence-action-modal/occurrence-action-modal.component';

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildMonthDays(currentDate: Date): Date[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  const days: Date[] = [];
  const iter = new Date(startDate);
  for (let i = 0; i < 42; i++) {
    days.push(new Date(iter));
    iter.setDate(iter.getDate() + 1);
  }
  return days;
}

function buildWeekDays(currentDate: Date): Date[] {
  const start = new Date(currentDate);
  start.setDate(currentDate.getDate() - currentDate.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function toCalendarEvent(occ: OccurrenceView): CalendarEvent {
  return {
    id: occ.occurrenceId,
    title: occ.eventTitle,
    start: occ.startsAt,
    end: occ.endsAt,
    color: occ.status === 'moved' ? '#f59e0b' : occ.eventColor,
    resource: {
      status: occ.status
    }
  };
}

@Component({
  selector: 'app-event-calendar',
  standalone: true,
  imports: [
    CommonModule,
    SharedCalendarComponent,
    EventFormModalComponent,
    OccurrenceActionModalComponent
  ],
  templateUrl: './event-calendar.component.html'
})
export class EventCalendarComponent implements OnInit {
  readonly weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly timeSlots: number[] = Array.from({ length: 24 }, (_, i) => i);

  readonly currentDate = signal(new Date());
  readonly calendarViewType = signal<'monthly' | 'weekly' | 'daily'>('monthly');
  readonly occurrences = signal<OccurrenceView[]>([]);
  readonly isLoadingOccurrences = signal(false);

  readonly showEventForm = signal(false);
  readonly eventFormData = signal<EventFormModalData | null>(null);

  readonly showOccurrenceAction = signal(false);
  readonly occurrenceActionData = signal<OccurrenceActionModalData | null>(null);

  readonly calendarEvents = computed(() => this.occurrences().map(toCalendarEvent));
  readonly calendarDays = computed(() => buildMonthDays(this.currentDate()));
  readonly weeklyDays = computed(() => buildWeekDays(this.currentDate()));

  constructor(private eventCalendarService: EventCalendarService) {}

  ngOnInit(): void {
    this.reloadOccurrences();
  }

  // Shared calendar callbacks
  readonly getCalendarTitle = (): string => {
    const d = this.currentDate();
    if (this.calendarViewType() === 'monthly') {
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (this.calendarViewType() === 'weekly') {
      const week = this.weeklyDays();
      const start = week[0];
      const end = week[6];
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  readonly isToday = (day: Date): boolean => sameDay(day, new Date());
  readonly isCurrentMonth = (day: Date): boolean => day.getMonth() === this.currentDate().getMonth() && day.getFullYear() === this.currentDate().getFullYear();
  readonly isPastDate = (_day: Date): boolean => false;
  readonly getEventsForDay = (day: Date): CalendarEvent[] => this.calendarEvents().filter(e => sameDay(e.start, day));
  readonly formatTime = (iso: string): string => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  readonly formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };
  readonly formatDate = (d: Date): string => d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  readonly getEventTopPosition = (event: CalendarEvent): number => {
    const start = new Date(event.start);
    const hour = start.getHours();
    const minute = start.getMinutes();
    return (hour + minute / 60) * 61;
  };
  readonly getEventHeight = (event: CalendarEvent): number => {
    const durationMs = new Date(event.end).getTime() - new Date(event.start).getTime();
    return Math.max(60, (durationMs / (1000 * 60 * 60)) * 60);
  };
  readonly getEventLeftPosition = (_event: CalendarEvent, _day: Date): number => 0;
  readonly getEventWidth = (_event: CalendarEvent, _day: Date): number => 96;
  readonly getEventLeftBorderColor = (event: CalendarEvent): string => event.color || '#3b82f6';
  readonly getEventBackgroundColor = (color: string | undefined): string => {
    const hex = (color || '#3b82f6').replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.2)`;
  };
  readonly getProgramName = (_event: CalendarEvent): string => '';
  readonly getStaffCount = (_event: CalendarEvent): number => 0;
  readonly getAssignedHours = (_event: CalendarEvent): number => 0;
  readonly getTargetHours = (_event: CalendarEvent): number => 0;

  onViewTypeChange(next: 'monthly' | 'weekly' | 'daily'): void {
    this.calendarViewType.set(next);
    this.reloadOccurrences();
  }

  onPrevious(): void {
    const d = new Date(this.currentDate());
    if (this.calendarViewType() === 'monthly') d.setMonth(d.getMonth() - 1);
    else if (this.calendarViewType() === 'weekly') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    this.currentDate.set(d);
    this.reloadOccurrences();
  }

  onNext(): void {
    const d = new Date(this.currentDate());
    if (this.calendarViewType() === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (this.calendarViewType() === 'weekly') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    this.currentDate.set(d);
    this.reloadOccurrences();
  }

  onToday(): void {
    this.currentDate.set(new Date());
    this.reloadOccurrences();
  }

  onDayClick(day: Date): void {
    this.eventFormData.set({ mode: 'create', initialDate: day });
    this.showEventForm.set(true);
  }

  onCreateNewEvent(): void {
    this.onDayClick(new Date());
  }

  onEventClick(payload: { event: CalendarEvent; domEvent: MouseEvent }): void {
    payload.domEvent.stopPropagation();
    const occurrence = this.occurrences().find(o => o.occurrenceId === payload.event.id);
    if (!occurrence) return;

    const eventEntity = this.eventCalendarService.events().find(e => e.id === occurrence.eventId);
    if (!eventEntity) return;

    this.eventCalendarService.ensureScheduleLoaded(eventEntity.id).subscribe({
      next: (schedule) => {
        if (!schedule) return;
        this.occurrenceActionData.set({
          occurrence,
          event: eventEntity,
          currentSchedule: schedule
        });
        this.showOccurrenceAction.set(true);
      }
    });
  }

  onEventFormSave(result: EventFormResult): void {
    if (result.eventId) {
      this.eventCalendarService.updateEvent(result.eventId, result.title, result.color);
      this.eventCalendarService.updateEventSchedule(result.eventId, result.definition).subscribe({
        next: () => this.reloadOccurrences(),
        error: () => this.reloadOccurrences()
      });
    } else {
      this.eventCalendarService.createEvent(result.title, result.color, result.definition).subscribe({
        next: () => this.reloadOccurrences(),
        error: () => this.reloadOccurrences()
      });
    }

    this.showEventForm.set(false);
    this.eventFormData.set(null);
  }

  onEventFormCancel(): void {
    this.showEventForm.set(false);
    this.eventFormData.set(null);
  }

  onOccurrenceAction(action: OccurrenceAction): void {
    const data = this.occurrenceActionData();
    if (!data) return;

    if (action.type === 'skip') {
      this.eventCalendarService
        .skipOccurrence(data.event.id, data.occurrence.scheduleId, data.occurrence.startsAt)
        .subscribe({
        next: () => this.reloadOccurrences(),
        error: () => this.reloadOccurrences()
      });
    } else if (action.type === 'move') {
      this.eventCalendarService.moveOccurrence(
        data.event.id,
        data.occurrence.scheduleId,
        data.occurrence.startsAt,
        action.newStartsAt,
        action.newEndsAt
      );
      this.reloadOccurrences();
    } else if (action.type === 'split') {
      this.eventCalendarService.splitSchedule(
        data.event.id,
        data.occurrence.scheduleId,
        action.fromDate,
        action.newDefinition
      ).subscribe({
        next: () => this.reloadOccurrences(),
        error: () => this.reloadOccurrences()
      });
    } else if (action.type === 'edit-all') {
      this.eventCalendarService.editAllOccurrences(data.event.id, action.newDefinition).subscribe({
        next: () => this.reloadOccurrences(),
        error: () => this.reloadOccurrences()
      });
    }

    this.onOccurrenceActionCancel();
  }

  onOccurrenceActionCancel(): void {
    this.showOccurrenceAction.set(false);
    this.occurrenceActionData.set(null);
  }

  private reloadOccurrences(): void {
    const range = this.getRangeForCurrentView();
    this.isLoadingOccurrences.set(true);
    this.eventCalendarService
      .getOccurrencesForRange(range.start, range.end)
      .pipe(finalize(() => this.isLoadingOccurrences.set(false)))
      .subscribe({
        next: (occ) => this.occurrences.set(occ),
        error: () => this.occurrences.set([])
      });
  }

  private getRangeForCurrentView(): { start: Date; end: Date } {
    const now = this.currentDate();
    const view = this.calendarViewType();
    let start: Date;
    let end: Date;

    if (view === 'monthly') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (view === 'weekly') {
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }
}
