import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarEvent } from '../../../models/schedule.models';

/**
 * Shared presentational calendar component.
 * Renders calendar UI (monthly/weekly/daily views) with no business logic.
 * All data and callbacks are provided via @Input/@Output.
 */
@Component({
  selector: 'app-shared-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shared-calendar.component.html',
  styleUrls: ['./shared-calendar.component.scss']
})
export class SharedCalendarComponent {
  /** When true, calendar days accept drag-and-drop (e.g. shift → day to create schedule). */
  @Input() shiftDropEnabled = false;
  /** Highlight day column while dragging over (weekly/daily). */
  @Input() dragOverDay: Date | null = null;

  // Data inputs
  @Input() calendarViewType: 'monthly' | 'weekly' | 'daily' = 'weekly';
  @Input() calendarEvents: CalendarEvent[] = [];
  @Input() isLoadingOccurrences: boolean = false;
  @Input() weekDays: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  @Input() calendarDays: Date[] = [];
  @Input() weeklyDays: Date[] = [];
  @Input() timeSlots: number[] = [];
  @Input() currentDate: Date = new Date();

  // Function inputs
  @Input() getCalendarTitle!: () => string;
  @Input() isToday!: (day: Date) => boolean;
  @Input() isCurrentMonth!: (day: Date) => boolean;
  @Input() isPastDate!: (day: Date) => boolean;
  @Input() getEventsForDay!: (day: Date) => CalendarEvent[];
  @Input() formatTime!: (iso: string) => string;
  @Input() formatHour!: (hour: number) => string;
  @Input() formatDate!: (date: Date) => string;
  @Input() getEventTopPosition!: (event: CalendarEvent) => number;
  @Input() getEventHeight!: (event: CalendarEvent) => number;
  @Input() getEventLeftPosition!: (event: CalendarEvent, day: Date) => number;
  @Input() getEventWidth!: (event: CalendarEvent, day: Date) => number;
  @Input() getEventLeftBorderColor!: (event: CalendarEvent) => string;
  @Input() getEventBackgroundColor!: (color: string | undefined) => string;
  @Input() getProgramName!: (event: CalendarEvent) => string;
  @Input() getStaffCount!: (event: CalendarEvent) => number;
  @Input() getAssignedHours!: (event: CalendarEvent) => number;
  @Input() getTargetHours!: (event: CalendarEvent) => number;

  // Event outputs
  @Output() viewTypeChange = new EventEmitter<'monthly' | 'weekly' | 'daily'>();
  @Output() previous = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() today = new EventEmitter<void>();
  @Output() eventClick = new EventEmitter<{ event: CalendarEvent; domEvent: MouseEvent }>();
  /** Fired when a dragged shift is dropped on a day (local date). */
  @Output() dayDrop = new EventEmitter<Date>();
  /** Fired when a day cell is clicked (event calendar use-case). */
  @Output() dayClick = new EventEmitter<Date>();

  isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  onNativeDragOver(ev: DragEvent): void {
    if (!this.shiftDropEnabled) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
  }

  onNativeDrop(day: Date, ev: DragEvent): void {
    if (!this.shiftDropEnabled) return;
    ev.preventDefault();
    this.dayDrop.emit(new Date(day.getFullYear(), day.getMonth(), day.getDate()));
  }

  onViewTypeChange(viewType: 'monthly' | 'weekly' | 'daily'): void {
    this.viewTypeChange.emit(viewType);
  }

  onPrevious(): void {
    this.previous.emit();
  }

  onNext(): void {
    this.next.emit();
  }

  onToday(): void {
    this.today.emit();
  }

  onEventClick(event: CalendarEvent, domEvent: MouseEvent): void {
    this.eventClick.emit({ event, domEvent });
  }

  onDayClick(day: Date): void {
    this.dayClick.emit(new Date(day.getFullYear(), day.getMonth(), day.getDate()));
  }
}
