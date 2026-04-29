import {
  Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RRule, Weekday, Options } from 'rrule';
import { ScheduleDefinitionPayload } from '../../models/scheduling.models';
import { WeekdayPickerComponent } from '../../shared/weekday-picker/weekday-picker.component';
import { OccurrencePreviewComponent } from '../../shared/occurrence-preview/occurrence-preview.component';

export type FreqUnit = 'daily' | 'weekly' | 'monthly' | 'yearly';

const IANA_TIMEZONES = [
  'UTC',
  'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage', 'America/Honolulu',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Istanbul',
  'Asia/Kolkata', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Bangkok',
  'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Sydney', 'Pacific/Auckland'
];

function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

@Component({
  selector: 'app-schedule-definition',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, WeekdayPickerComponent, OccurrencePreviewComponent],
  templateUrl: './schedule-definition.component.html',
  styleUrls: ['./schedule-definition.component.scss']
})
export class ScheduleDefinitionComponent implements OnInit, OnChanges {
  @Input() value: ScheduleDefinitionPayload | null = null;
  @Input() timezone: string = getBrowserTimezone();
  @Input() showPreview: boolean = true;
  @Input() previewCount: number = 10;

  @Output() valueChange = new EventEmitter<ScheduleDefinitionPayload>();
  @Output() validChange = new EventEmitter<boolean>();

  // ─── Constants exposed to template ──────────────────────────────────────
  readonly timezones = IANA_TIMEZONES;
  readonly weekDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly fullWeekDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  readonly ordinalOptions = [
    { value: '1',    label: '1st' },
    { value: '2',    label: '2nd' },
    { value: '3',    label: '3rd' },
    { value: '4',    label: '4th' },
    { value: 'last', label: 'Last' },
  ];
  readonly daysInMonthOptions = Array.from({ length: 31 }, (_, i) => i + 1);
  readonly monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  // ─── Main form ───────────────────────────────────────────────────────────
  form!: FormGroup;

  // ─── Recurrence toggle ───────────────────────────────────────────────────
  isRecurring = false;

  // ─── Weekly ──────────────────────────────────────────────────────────────
  weekDays: number[] = [];

  // ─── Monthly ─────────────────────────────────────────────────────────────
  monthlyMode: 'arbitrary' | 'ordinal' = 'arbitrary';
  monthlyArbitraryDays: number[] = [];   // day numbers 1–31 → BYMONTHDAY
  monthlyWeekdays: number[] = [];        // for ordinal mode

  // ─── Yearly ──────────────────────────────────────────────────────────────
  yearlyMode: 'day' | 'ordinal' = 'day';
  yearlyWeekdays: number[] = [];

  // ─── Exdate management ──────────────────────────────────────────────────
  private exdateSet = new Set<string>();
  exdatesArray: string[] = [];

  // ─── Current RRULE string ────────────────────────────────────────────────
  currentRRule = '';

  // ─── Echo-loop guard ─────────────────────────────────────────────────────
  private lastEmittedPayload: ScheduleDefinitionPayload | null = null;

  constructor(private fb: FormBuilder) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.buildForm();
    if (this.value) this.patchFromValue(this.value);
    this.form.valueChanges.subscribe(() => this.emitValue());
    this.emitValue();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && !changes['value'].firstChange && this.form) {
      const v = changes['value'].currentValue as ScheduleDefinitionPayload | null;
      if (!v) return;
      if (this.isSamePayload(v, this.lastEmittedPayload)) return;
      this.patchFromValue(v);
      this.emitValue();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Form construction
  // ─────────────────────────────────────────────────────────────────────────

  private buildForm(): void {
    const now = new Date();
    const dtstart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T09:00`;

    this.form = this.fb.group({
      dtstart:         [dtstart,                     Validators.required],
      timezone:        [this.timezone,               Validators.required],
      durationSeconds: [3600,                        [Validators.required, Validators.min(60)]],
      // Recurrence controls
      freqUnit:        ['daily'],
      interval:        [1,                           [Validators.min(1)]],
      endType:         ['never'],
      endDate:         [''],
      endCount:        [1,                           [Validators.min(1)]],
      // Monthly ordinal
      monthlyOrdinal:  ['1'],
      // Yearly
      yearlyMonth:     [now.getMonth() + 1],
      yearlyDay:       [now.getDate()],
      yearlyOrdinal:   ['1'],
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Patch from external value
  // ─────────────────────────────────────────────────────────────────────────

  private patchFromValue(v: ScheduleDefinitionPayload): void {
    this.exdateSet = new Set(
      (v.exdate ?? '').split(',').map(s => s.trim()).filter(Boolean)
    );
    this.syncExdatesArray();

    const rrule = v.rrule ?? '';
    const until = this.extractUntil(rrule);
    const count = this.extractCount(rrule);
    const interval = this.extractInterval(rrule) ?? 1;

    if (!rrule || rrule.includes('COUNT=1')) {
      this.isRecurring = false;
    } else {
      this.isRecurring = true;
    }

    let freqUnit: FreqUnit = 'daily';
    if (rrule.includes('FREQ=WEEKLY'))  freqUnit = 'weekly';
    if (rrule.includes('FREQ=MONTHLY')) freqUnit = 'monthly';
    if (rrule.includes('FREQ=YEARLY'))  freqUnit = 'yearly';

    this.form.patchValue({
      dtstart:         v.dtstart.substring(0, 16),
      timezone:        v.timezone,
      durationSeconds: v.durationSeconds ?? 3600,
      freqUnit,
      interval,
      endType:  until ? 'on' : (count && count > 1) ? 'after' : 'never',
      endDate:  until ?? '',
      endCount: count && count > 1 ? count : 1,
    }, { emitEvent: false });

    this.currentRRule = rrule;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Template event handlers
  // ─────────────────────────────────────────────────────────────────────────

  onIsRecurringChange(event: Event): void {
    this.isRecurring = (event.target as HTMLInputElement).checked;
    this.emitValue();
  }

  onWeekDaysChange(days: number[]): void {
    this.weekDays = days;
    this.emitValue();
  }

  onMonthlyModeChange(mode: 'arbitrary' | 'ordinal'): void {
    this.monthlyMode = mode;
    this.emitValue();
  }

  onMonthlyWeekdaysChange(days: number[]): void {
    this.monthlyWeekdays = days;
    this.emitValue();
  }

  onYearlyModeChange(mode: 'day' | 'ordinal'): void {
    this.yearlyMode = mode;
    this.emitValue();
  }

  onYearlyWeekdaysChange(days: number[]): void {
    this.yearlyWeekdays = days;
    this.emitValue();
  }

  toggleMonthDay(day: number): void {
    const idx = this.monthlyArbitraryDays.indexOf(day);
    this.monthlyArbitraryDays = idx >= 0
      ? this.monthlyArbitraryDays.filter(d => d !== day)
      : [...this.monthlyArbitraryDays, day].sort((a, b) => a - b);
    this.emitValue();
  }

  isMonthDaySelected(day: number): boolean {
    return this.monthlyArbitraryDays.includes(day);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Exdate management
  // ─────────────────────────────────────────────────────────────────────────

  onToggleExdate(isoLocal: string): void {
    if (this.exdateSet.has(isoLocal)) {
      this.exdateSet.delete(isoLocal);
    } else {
      this.exdateSet.add(isoLocal);
    }
    this.syncExdatesArray();
    this.emitValue();
  }

  private syncExdatesArray(): void {
    this.exdatesArray = [...this.exdateSet];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RRULE building
  // ─────────────────────────────────────────────────────────────────────────

  buildRRule(): string {
    if (!this.isRecurring) return 'FREQ=DAILY;COUNT=1';

    const v = this.form.value;
    const freqUnit = v.freqUnit as FreqUnit;
    const interval = Number(v.interval) || 1;
    const opts: Partial<Options> = { interval };

    switch (freqUnit) {
      case 'daily':
        opts.freq = RRule.DAILY;
        break;

      case 'weekly':
        opts.freq = RRule.WEEKLY;
        if (this.weekDays.length > 0) {
          opts.byweekday = this.weekDays.map(d => this.jsWeekdayToRRule(d));
        }
        break;

      case 'monthly':
        opts.freq = RRule.MONTHLY;
        if (this.monthlyMode === 'arbitrary') {
          if (this.monthlyArbitraryDays.length > 0) {
            opts.bymonthday = this.monthlyArbitraryDays as any;
          }
        } else if (this.monthlyWeekdays.length > 0) {
          const ordNum = v.monthlyOrdinal === 'last' ? -1 : parseInt(v.monthlyOrdinal, 10);
          opts.byweekday = this.monthlyWeekdays.map(wd => this.jsWeekdayToRRule(wd).nth(ordNum));
        }
        break;

      case 'yearly':
        opts.freq = RRule.YEARLY;
        opts.bymonth = Number(v.yearlyMonth) || 1;
        if (this.yearlyMode === 'day') {
          opts.bymonthday = Number(v.yearlyDay) || 1;
        } else if (this.yearlyWeekdays.length > 0) {
          const ordNum = v.yearlyOrdinal === 'last' ? -1 : parseInt(v.yearlyOrdinal, 10);
          opts.byweekday = this.yearlyWeekdays.map(wd => this.jsWeekdayToRRule(wd).nth(ordNum));
        }
        break;
    }

    if (v.endType === 'on' && v.endDate) {
      const [y, m, d] = (v.endDate as string).split('-').map(Number);
      opts.until = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
    } else if (v.endType === 'after' && Number(v.endCount) > 0) {
      opts.count = Number(v.endCount);
    }

    return new RRule(opts).toString().replace(/^RRULE:/, '');
  }

  private jsWeekdayToRRule(day: number): Weekday {
    return [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA][day];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Emit payload
  // ─────────────────────────────────────────────────────────────────────────

  emitValue(): void {
    const dtstart = this.form.get('dtstart')?.value as string;
    this.currentRRule = this.buildRRule();

    if (!dtstart || this.form.invalid) {
      this.validChange.emit(false);
      return;
    }

    const payload: ScheduleDefinitionPayload = {
      evaluatorType:   'Rfc5545',
      rrule:           this.currentRRule,
      dtstart:         dtstart.length === 16 ? dtstart + ':00' : dtstart,
      timezone:        this.form.get('timezone')?.value ?? getBrowserTimezone(),
      durationSeconds: Number(this.form.get('durationSeconds')?.value) || 3600,
      isActive:        true
    };

    if (this.exdateSet.size > 0) {
      payload.exdate = [...this.exdateSet].join(',');
    }

    this.validChange.emit(true);
    this.lastEmittedPayload = payload;
    this.valueChange.emit(payload);
  }

  private isSamePayload(a: ScheduleDefinitionPayload, b: ScheduleDefinitionPayload | null): boolean {
    if (!b) return false;
    return a.rrule            === b.rrule &&
           a.dtstart          === b.dtstart &&
           a.timezone         === b.timezone &&
           a.durationSeconds  === b.durationSeconds &&
           (a.exdate ?? '')   === (b.exdate ?? '');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Template helpers
  // ─────────────────────────────────────────────────────────────────────────

  get dtstartFull(): string {
    const v = this.form?.get('dtstart')?.value as string ?? '';
    return v.length === 16 ? v + ':00' : v;
  }

  get freqUnitLabel(): string {
    const labels: Record<FreqUnit, string> = {
      daily:   'Day(s)',
      weekly:  'Week(s)',
      monthly: 'Month(s)',
      yearly:  'Year(s)',
    };
    return labels[this.form?.get('freqUnit')?.value as FreqUnit] ?? 'Day(s)';
  }

  get frequencyLabel(): string {
    if (!this.isRecurring) return 'Does not repeat';
    const unit = this.form?.get('freqUnit')?.value as FreqUnit;
    const interval = Number(this.form?.get('interval')?.value) || 1;
    const prefix = interval === 1 ? 'Every' : `Every ${interval}`;

    switch (unit) {
      case 'daily':
        return `${prefix} day`;
      case 'weekly': {
        const days = this.weekDays.map(i => this.weekDayLabels[i]).join(', ');
        return days ? `${prefix} week on ${days}` : `${prefix} week`;
      }
      case 'monthly':
        if (this.monthlyMode === 'arbitrary' && this.monthlyArbitraryDays.length > 0) {
          return `${prefix} month on day(s) ${this.monthlyArbitraryDays.join(', ')}`;
        }
        if (this.monthlyMode === 'ordinal' && this.monthlyWeekdays.length > 0) {
          const ord = this.ordinalOptions.find(o => o.value === this.form?.get('monthlyOrdinal')?.value);
          const days = this.monthlyWeekdays.map(i => this.weekDayLabels[i]).join(', ');
          return `${prefix} month on the ${ord?.label ?? ''} ${days}`;
        }
        return `${prefix} month`;
      case 'yearly': {
        const month = this.monthNames[(Number(this.form?.get('yearlyMonth')?.value) || 1) - 1];
        if (this.yearlyMode === 'day') {
          return `${prefix} year on ${month} ${this.form?.get('yearlyDay')?.value ?? ''}`;
        }
        const ord = this.ordinalOptions.find(o => o.value === this.form?.get('yearlyOrdinal')?.value);
        const days = this.yearlyWeekdays.map(i => this.weekDayLabels[i]).join(', ');
        return `${prefix} year on the ${ord?.label ?? ''} ${days} of ${month}`;
      }
    }
    return '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private extractInterval(rrule: string): number | null {
    const m = rrule?.match(/INTERVAL=(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  private extractCount(rrule: string): number | null {
    const m = rrule?.match(/COUNT=(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  private extractUntil(rrule: string): string {
    const m = rrule?.match(/UNTIL=(\d{8}T\d{6}Z?)/);
    if (!m) return '';
    const s = m[1];
    return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
  }
}
