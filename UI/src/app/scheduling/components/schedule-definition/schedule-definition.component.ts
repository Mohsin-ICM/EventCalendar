import {
  Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RRule, Weekday, Options } from 'rrule';
import { ScheduleDefinitionPayload } from '../../models/scheduling.models';
import { WeekdayPickerComponent } from '../../shared/weekday-picker/weekday-picker.component';
import { OccurrencePreviewComponent } from '../../shared/occurrence-preview/occurrence-preview.component';

export type FrequencyOption =
  'none' | 'daily' | 'weekly' | 'monthly' | 'annually' | 'weekdays' | 'custom';

interface MonthlyState {
  /** 'day'     → BYMONTHDAY=N
   *  'weekday' → BYDAY=<ordinal>XX[,<ordinal>YY…] (e.g. -1TH,-1MO = last Thu & Mon) */
  type: 'day' | 'weekday';
  day: number;           // 1–31
  ordinal: string;       // '1' | '2' | '3' | '4' | 'last'
  weekdays: number[];    // JS indices 0-6, multiple allowed
}

/** Yearly is like monthly but also picks a calendar month (BYMONTH=N). */
interface YearlyState {
  month: number;         // 1–12
  type: 'day' | 'weekday';
  day: number;           // 1–31  (type === 'day')
  ordinal: string;       // '1' | '2' | '3' | '4' | 'last'
  weekdays: number[];    // JS indices 0-6 (type === 'weekday')
}

interface CustomRecurrenceState {
  interval: number;
  freq: 'day' | 'week' | 'month' | 'year';
  weekDays: number[];
  endType: 'never' | 'on' | 'after';
  endDate: string;
  count: number;
  monthly: MonthlyState;
  yearly: YearlyState;
}

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

  readonly showCustomRecurrenceModal = signal(false);

  // ─── Forms ───────────────────────────────────────────────────────────────
  form!: FormGroup;
  customForm!: FormGroup;

  // ─── Weekday selections for custom pickers ──────────────────────────────
  customWeekDays: number[] = [];          // weekly
  customMonthlyWeekdays: number[] = [];   // monthly "by position"
  customYearlyWeekdays: number[] = [];    // yearly "by position"

  // ─── Exdate management ──────────────────────────────────────────────────
  private exdateSet = new Set<string>();
  exdatesArray: string[] = [];     // reference-stable copy passed to preview child

  // ─── Current RRULE string (kept in sync via emit()) ─────────────────────
  currentRRule: string = '';

  // ─── Saved custom state (null = no custom recurrence applied) ────────────
  private customRecurrence: CustomRecurrenceState | null = null;

  // ─── Echo-loop guard: last payload we emitted so ngOnChanges can skip it ─
  private lastEmittedPayload: ScheduleDefinitionPayload | null = null;

  constructor(private fb: FormBuilder) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.buildForms();
    if (this.value) this.patchFromValue(this.value);
    this.subscribeFormChanges();
    this.emit();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && !changes['value'].firstChange && this.form) {
      const v = changes['value'].currentValue as ScheduleDefinitionPayload | null;
      if (!v) return;
      if (this.isSamePayload(v, this.lastEmittedPayload)) return; // skip echo-back
      this.patchFromValue(v);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Form construction
  // ─────────────────────────────────────────────────────────────────────────

  private buildForms(): void {
    const now = new Date();
    const dtstart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T09:00`;

    this.form = this.fb.group({
      dtstart:         [dtstart,           Validators.required],
      timezone:        [this.timezone,     Validators.required],
      durationSeconds: [3600,              [Validators.required, Validators.min(60)]],
      frequency:       ['none',            Validators.required],
      repeatUntil:     ['']
    });

    this.customForm = this.fb.group({
      interval:       [1,       [Validators.required, Validators.min(1)]],
      freq:           ['week',  Validators.required],
      endType:        ['never', Validators.required],
      endDate:        [''],
      count:          [10,      [Validators.min(1)]],
      // Monthly sub-fields (weekdays tracked separately via customMonthlyWeekdays)
      monthlyType:    ['day'],
      monthlyDay:     [1],
      monthlyOrdinal: ['1'],
      // Yearly sub-fields (weekdays tracked separately via customYearlyWeekdays)
      yearlyMonth:    [new Date().getMonth() + 1],
      yearlyType:     ['day'],
      yearlyDay:      [new Date().getDate()],
      yearlyOrdinal:  ['1'],
    });
  }

  private subscribeFormChanges(): void {
    // Re-emit on every form change (recomputes RRULE, updates currentRRule)
    this.form.valueChanges.subscribe(() => this.emit());

    // Only 'custom' opens the modal. Monthly / annually build their RRULE
    // automatically from dtstart — no modal needed.
    this.form.get('frequency')!.valueChanges.subscribe((freq: FrequencyOption) => {
      if (freq !== 'custom') {
        this.customRecurrence = null;
      } else {
        this.syncCustomFormFromCurrent('custom');
        this.showCustomRecurrenceModal.set(true);
      }
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

    const freq = this.detectFrequency(v.rrule);
    const until = this.extractUntil(v.rrule);

    this.form.patchValue({
      dtstart:         v.dtstart.substring(0, 16),
      timezone:        v.timezone,
      durationSeconds: v.durationSeconds ?? 3600,
      frequency:       freq,
      repeatUntil:     until
    }, { emitEvent: false });

    this.currentRRule = v.rrule;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Custom recurrence modal
  // ─────────────────────────────────────────────────────────────────────────

  /** Re-open the modal for frequencies that require configuration. */
  openEditModal(): void {
    const freq = this.form.get('frequency')?.value as FrequencyOption;
    this.syncCustomFormFromCurrent(freq);
    this.showCustomRecurrenceModal.set(true);
  }

  closeCustomModal(): void {
    this.showCustomRecurrenceModal.set(false);
    // If nothing was ever saved, revert the select back to 'none'
    if (!this.customRecurrence) {
      this.form.patchValue({ frequency: 'none' }, { emitEvent: false });
      this.emit();
    }
  }

  saveCustomRecurrence(): void {
    if (this.customForm.invalid) {
      this.customForm.markAllAsTouched();
      return;
    }
    const v = this.customForm.value;
    const saved: CustomRecurrenceState = {
      interval:  Number(v.interval) || 1,
      freq:      v.freq,
      weekDays:  [...this.customWeekDays].sort((a, b) => a - b),
      endType:   v.endType,
      endDate:   v.endDate || '',
      count:     Number(v.count) || 10,
      monthly: {
        type:     v.monthlyType || 'day',
        day:      Number(v.monthlyDay) || 1,
        ordinal:  v.monthlyOrdinal || '1',
        weekdays: [...this.customMonthlyWeekdays].sort((a, b) => a - b),
      },
      yearly: {
        month:    Number(v.yearlyMonth) || 1,
        type:     v.yearlyType || 'day',
        day:      Number(v.yearlyDay) || 1,
        ordinal:  v.yearlyOrdinal || '1',
        weekdays: [...this.customYearlyWeekdays].sort((a, b) => a - b),
      },
    };
    this.customRecurrence = saved;

    this.form.patchValue({ frequency: this.mapCustomToDisplayFreq() }, { emitEvent: false });
    if (saved.endType === 'on') {
      this.form.patchValue({ repeatUntil: saved.endDate }, { emitEvent: false });
    } else {
      this.form.patchValue({ repeatUntil: '' }, { emitEvent: false });
    }

    this.showCustomRecurrenceModal.set(false);
    this.emit();
  }

  private mapCustomToDisplayFreq(): FrequencyOption {
    const c = this.customRecurrence!;
    if (c.freq === 'week' && c.interval === 1) {
      const s = [...c.weekDays].sort((a, b) => a - b);
      if (s.length === 5 && [1,2,3,4,5].every((d, i) => s[i] === d)) return 'weekdays';
      return 'weekly';
    }
    if (c.freq === 'week')  return 'weekly';
    if (c.freq === 'month') return 'monthly';
    if (c.freq === 'year')  return 'annually';
    return 'daily';
  }

  private syncCustomFormFromCurrent(triggerFreq: FrequencyOption = 'custom'): void {
    // Map the trigger to the internal freq value used by customForm
    const freqMap: Partial<Record<FrequencyOption, string>> = {
      monthly:  'month',
      annually: 'year',
      weekly:   'week',
      custom:   this.customRecurrence?.freq ?? 'week',
    };
    const defaultInternalFreq = freqMap[triggerFreq] ?? 'week';

    if (this.customRecurrence) {
      this.customWeekDays         = [...this.customRecurrence.weekDays];
      this.customMonthlyWeekdays  = [...this.customRecurrence.monthly.weekdays];
      this.customYearlyWeekdays   = [...this.customRecurrence.yearly.weekdays];
      this.customForm.patchValue({
        interval:       this.customRecurrence.interval,
        freq:           this.customRecurrence.freq,
        endType:        this.customRecurrence.endType,
        endDate:        this.customRecurrence.endDate,
        count:          this.customRecurrence.count,
        monthlyType:    this.customRecurrence.monthly.type,
        monthlyDay:     this.customRecurrence.monthly.day,
        monthlyOrdinal: this.customRecurrence.monthly.ordinal,
        yearlyMonth:    this.customRecurrence.yearly.month,
        yearlyType:     this.customRecurrence.yearly.type,
        yearlyDay:      this.customRecurrence.yearly.day,
        yearlyOrdinal:  this.customRecurrence.yearly.ordinal,
      });
      return;
    }

    // Fresh defaults seeded from dtstart
    const d          = this.getDtstart();
    const wkIdx      = d?.getUTCDay() ?? 1;
    const day        = d?.getUTCDate() ?? 1;
    const month      = d ? d.getUTCMonth() + 1 : new Date().getMonth() + 1;
    const ordinal    = d ? this.getWeekdayOccurrenceForDate(d) : 1;
    const isLast     = d ? this.isLastWeekdayInMonth(d) : false;
    const defOrdinal = isLast ? 'last' : String(ordinal);

    this.customWeekDays        = [wkIdx];
    this.customMonthlyWeekdays = [wkIdx];
    this.customYearlyWeekdays  = [wkIdx];

    this.customForm.patchValue({
      interval:       1,
      freq:           defaultInternalFreq,
      endType:        'never',
      endDate:        '',
      count:          10,
      monthlyType:    'day',
      monthlyDay:     day,
      monthlyOrdinal: defOrdinal,
      yearlyMonth:    month,
      yearlyType:     'day',
      yearlyDay:      day,
      yearlyOrdinal:  defOrdinal,
    });
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
    this.emit();
  }

  private syncExdatesArray(): void {
    this.exdatesArray = [...this.exdateSet];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RRULE building — all occurrence math goes through rrule.js
  // ─────────────────────────────────────────────────────────────────────────

  buildRRule(): string {
    const freq = this.form.get('frequency')?.value as FrequencyOption;

    if (freq === 'none') return 'FREQ=DAILY;COUNT=1';
    // 'custom' is a transient state (modal open, nothing saved yet)
    if (freq === 'custom' && !this.customRecurrence) return 'FREQ=DAILY;COUNT=1';

    // Always use the custom builder when custom recurrence state is present,
    // regardless of the display-friendly freq label (fixes lost BYDAY details).
    if (this.customRecurrence) return this.buildCustomRRule();

    const opts: Partial<Options> = {};
    const repeatUntil = this.form.get('repeatUntil')?.value as string;

    switch (freq) {
      case 'daily':
        opts.freq = RRule.DAILY;
        break;
      case 'weekdays':
        opts.freq = RRule.WEEKLY;
        opts.byweekday = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR];
        break;
      case 'weekly': {
        opts.freq = RRule.WEEKLY;
        const d = this.getDtstart();
        if (d) opts.byweekday = [this.jsWeekdayToRRule(d.getUTCDay())];
        break;
      }
      case 'monthly': {
        opts.freq = RRule.MONTHLY;
        const dm = this.getDtstart();
        if (dm) opts.bymonthday = dm.getUTCDate();
        break;
      }
      case 'annually': {
        opts.freq = RRule.YEARLY;
        const da = this.getDtstart();
        if (da) {
          opts.bymonth    = da.getUTCMonth() + 1;
          opts.bymonthday = da.getUTCDate();
        }
        break;
      }
    }

    if (repeatUntil) {
      const [y, m, d] = repeatUntil.split('-').map(Number);
      opts.until = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
    }

    return new RRule(opts).toString().replace(/^RRULE:/, '');
  }

  private buildCustomRRule(): string {
    const c = this.customRecurrence!;
    const opts: Partial<Options> = { interval: c.interval };

    switch (c.freq) {
      case 'day':   opts.freq = RRule.DAILY;   break;
      case 'week':  opts.freq = RRule.WEEKLY;  break;
      case 'month': opts.freq = RRule.MONTHLY; break;
      case 'year':  opts.freq = RRule.YEARLY;  break;
      default:      opts.freq = RRule.WEEKLY;
    }

    if (c.freq === 'week' && c.weekDays.length > 0) {
      opts.byweekday = c.weekDays.map(d => this.jsWeekdayToRRule(d));
    }

    if (c.freq === 'month') {
      if (c.monthly.type === 'day') {
        opts.bymonthday = c.monthly.day;
      } else if (c.monthly.weekdays.length > 0) {
        const ordinalNum = c.monthly.ordinal === 'last' ? -1 : parseInt(c.monthly.ordinal, 10);
        opts.byweekday = c.monthly.weekdays.map(wd => this.jsWeekdayToRRule(wd).nth(ordinalNum));
      }
    }

    if (c.freq === 'year') {
      opts.bymonth = c.yearly.month;
      if (c.yearly.type === 'day') {
        opts.bymonthday = c.yearly.day;
      } else if (c.yearly.weekdays.length > 0) {
        // e.g. "last Thursday of April" → FREQ=YEARLY;BYMONTH=4;BYDAY=-1TH
        const ordinalNum = c.yearly.ordinal === 'last' ? -1 : parseInt(c.yearly.ordinal, 10);
        opts.byweekday = c.yearly.weekdays.map(wd => this.jsWeekdayToRRule(wd).nth(ordinalNum));
      }
    }

    if (c.endType === 'on' && c.endDate) {
      const [y, m, d] = c.endDate.split('-').map(Number);
      opts.until = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
    } else if (c.endType === 'after' && c.count > 0) {
      opts.count = c.count;
    }

    return new RRule(opts).toString().replace(/^RRULE:/, '');
  }

  private jsWeekdayToRRule(day: number): Weekday {
    return [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA][day];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Emit payload
  // ─────────────────────────────────────────────────────────────────────────

  private emit(): void {
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

  /** Full ISO local dtstart for the preview child (ensures seconds suffix) */
  get dtstartFull(): string {
    const v = this.form?.get('dtstart')?.value as string ?? '';
    return v.length === 16 ? v + ':00' : v;
  }

  get frequencyLabel(): string {
    const freq = this.form?.get('frequency')?.value as FrequencyOption;
    const c = this.customRecurrence;

    if (freq === 'none') return 'Does not repeat';
    if (freq === 'weekdays') return 'Every weekday (Mon to Fri)';

    if (freq === 'daily') {
      if (c?.freq === 'day' && c.interval > 1) return `Every ${c.interval} days`;
      return 'Daily';
    }
    if (freq === 'weekly') {
      if (c?.freq === 'week') {
        const days = c.weekDays.map(i => this.weekDayLabels[i]).join(', ');
        const label = c.interval === 1 ? 'Every week' : `Every ${c.interval} weeks`;
        return days ? `${label} on ${days}` : label;
      }
      const d = this.getDtstart();
      return d ? `Weekly on ${this.weekDayLabels[d.getUTCDay()]}` : 'Weekly';
    }
    if (freq === 'monthly') {
      if (c?.freq === 'month') return this.buildMonthlyLabel(c);
      // Auto-derived from dtstart
      const dm = this.getDtstart();
      return dm ? `Monthly on day ${dm.getUTCDate()}` : 'Monthly';
    }
    if (freq === 'annually') {
      if (c?.freq === 'year') return this.buildYearlyLabel(c);
      // Auto-derived from dtstart
      const da = this.getDtstart();
      return da ? `Annually on ${this.monthNames[da.getUTCMonth()]} ${da.getUTCDate()}` : 'Annually';
    }
    return 'Custom';
  }

  private buildYearlyLabel(c: CustomRecurrenceState): string {
    const prefix = c.interval === 1 ? 'Annually' : `Every ${c.interval} years`;
    const monthName = this.monthNames[c.yearly.month - 1] ?? '';
    if (c.yearly.type === 'day') {
      return `${prefix} on ${monthName} ${c.yearly.day}`;
    }
    const ordLabel = c.yearly.ordinal === 'last'
      ? 'last'
      : ['', '1st', '2nd', '3rd', '4th'][parseInt(c.yearly.ordinal)] ?? c.yearly.ordinal;
    const wdNames = c.yearly.weekdays.map(i => this.fullWeekDayNames[i]).join(', ') || '—';
    return `${prefix} on the ${ordLabel} ${wdNames} of ${monthName}`;
  }

  private buildMonthlyLabel(c: CustomRecurrenceState): string {
    const prefix = c.interval === 1 ? 'Monthly' : `Every ${c.interval} months`;
    if (c.monthly.type === 'day') {
      return `${prefix} on day ${c.monthly.day}`;
    }
    const ordLabel = c.monthly.ordinal === 'last'
      ? 'last'
      : ['', '1st', '2nd', '3rd', '4th'][parseInt(c.monthly.ordinal)] ?? c.monthly.ordinal;
    const wdNames = c.monthly.weekdays.map(i => this.fullWeekDayNames[i]).join(', ') || '—';
    return `${prefix} on the ${ordLabel} ${wdNames}`;
  }

  /** Show the summary badge below the frequency select. */
  get showFrequencySummary(): boolean {
    const freq = this.form?.get('frequency')?.value as FrequencyOption;
    if (!freq || freq === 'none' || freq === 'daily' || freq === 'weekdays') return false;
    return true;
  }

  /** Show the Edit button inside the summary badge (only for modal-configured freqs). */
  get showFrequencyEditButton(): boolean {
    const freq = this.form?.get('frequency')?.value as FrequencyOption;
    // monthly and annually are auto-configured from dtstart — no edit needed
    if (freq === 'monthly' || freq === 'annually') return false;
    // weekly / custom only if custom recurrence state exists
    return !!this.customRecurrence;
  }

  get showRepeatUntil(): boolean {
    const freq = this.form?.get('frequency')?.value;
    if (freq === 'none') return false;
    return !this.customRecurrence || this.customRecurrence.endType === 'on';
  }

  get customEndSummary(): string {
    const c = this.customRecurrence;
    if (!c || c.endType === 'on') return '';
    if (c.endType === 'never') return 'Never ends';
    return `Ends after ${c.count} occurrence${c.count === 1 ? '' : 's'}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private getDtstart(): Date | null {
    const v = this.form?.get('dtstart')?.value as string;
    if (!v) return null;
    const d = new Date(v + 'Z');
    return isNaN(d.getTime()) ? null : d;
  }

  private detectFrequency(rrule: string): FrequencyOption {
    if (!rrule || rrule.includes('COUNT=1')) return 'none';
    if (rrule.includes('FREQ=DAILY')) {
      const byday = this.extractByDay(rrule);
      if (byday.length === 5 && ['MO','TU','WE','TH','FR'].every(d => byday.includes(d))) return 'weekdays';
      return 'daily';
    }
    if (rrule.includes('FREQ=WEEKLY'))  return 'weekly';
    if (rrule.includes('FREQ=MONTHLY')) return 'monthly';
    if (rrule.includes('FREQ=YEARLY'))  return 'annually';
    return 'none';
  }

  private extractByDay(rrule: string): string[] {
    const m = rrule.match(/BYDAY=([^;]+)/);
    return m ? m[1].split(',') : [];
  }

  private extractUntil(rrule: string): string {
    const m = rrule.match(/UNTIL=(\d{8}T\d{6}Z?)/);
    if (!m) return '';
    const s = m[1];
    return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
  }

  /** How many times has d's weekday already appeared this month (1-based) */
  private getWeekdayOccurrenceForDate(d: Date): number {
    let count = 0;
    for (let day = 1; day <= d.getUTCDate(); day++) {
      if (new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), day)).getUTCDay() === d.getUTCDay()) {
        count++;
      }
    }
    return count;
  }

  /** True if there is no later occurrence of d's weekday in the same month */
  private isLastWeekdayInMonth(d: Date): boolean {
    const nextWeek = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 7));
    return nextWeek.getUTCMonth() !== d.getUTCMonth();
  }
}
