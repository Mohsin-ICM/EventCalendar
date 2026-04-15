import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Shift } from '../../../models/schedule.models';
import { LucideAngularModule } from 'lucide-angular';
import { ModalStateService } from '../../services/modal-state.service';
import { TimeRangePipe } from '../../../shared/pipes/time-range.pipe';
import { IcmDateTimePipe } from '../../../shared/pipes/icm-date-time.pipe';

@Component({
  selector: 'icm-update-popup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, LucideAngularModule, TimeRangePipe, IcmDateTimePipe],
  templateUrl: './icm-update-popup.component.html',
  styleUrls: ['./icm-update-popup.component.css']
})
export class IcmUpdatePopupComponent implements OnChanges {
  @Input() header: string = 'Update';
  @Input() subHeader: string = '';
  @Input() icon: string = 'bi bi-pencil-square';
  @Input() visible: boolean = false;
  @Input() showCloseButton: boolean = true;
  @Input() closeAnimationMs: number = 200;
  @Input() panelClass: string = '';
  @Input() shift: Shift | null = null;
  @Input() isSaving = false;
  @Input() useDefaultForm = true;
  @Input() showName = false;
  @Input() showStartTime = false;
  @Input() showEndTime = false;
  @Input() showTargetHours = false;
  @Input() requireName = false;
  @Input() requireStartTime = false;
  @Input() requireEndTime = false;
  @Input() requireTargetHours = false;
  @Input() useStaffAssignmentForm = false;
  @Input() selectedShift: any = null;
  @Input() selectedSchedule: any = null;
  @Input() staffAssignments: any[] = [];
  @Input() staffSearchQuery = '';
  @Input() showStaffDropdown = false;
  @Input() filteredStaffList: any[] = [];
  @Input() currentStaffAssignment: any = null;
  @Input() editingStaffAssignmentIndex: number | null = null;
  @Input() newStaffAssignment = false;
  @Input() hasDraftAssignmentChanges = false;
  @Input() draftAssignmentRules: any[] = [];
  @Input() isSavingAssignmentDraft = false;
  @Input() isPublishingAssignmentDraft = false;
  @Input() canAssignStaff = true;
  @Input() canUnassignStaff = true;
  @Input() canEditSchedules = true;
  @Input() canDeleteSchedules = true;
  @Input() isOvernightShift = false;
  @Input() timeOffRequests: any[] = [];

  @Input() calculateTotalAssignedHours?: () => number;
  @Input() calculateRemainingHours?: () => number;
  @Input() getFrequencyDisplay?: (rrule: string) => string;
  @Input() getRepeatEveryDisplay?: (rrule: string) => string;
  @Input() frequencyRRule: string | null = null;
  @Input() formatDateForDisplay?: (date: any) => string;
  @Input() getUpdatedByInfo?: (schedule: any) => string | null;
  @Input() getProgramName?: (locationId?: number | null) => string;
  @Input() getStaffName?: (staffId: number) => string;
  @Input() getStaffRole?: (staffId: number) => string;
  @Input() formatTimeToAMPM?: (time: string) => string;
  @Input() getAssignmentHours?: (assignment: any) => number;
  @Input() isStaffAssignmentDraft?: (assignment: any) => boolean;
  @Input() isSingleOccurrenceNoParentScheduleForAssignment?: () => boolean;
  @Input() getSingleOccurrenceDateForAssignment?: () => string | Date;
  @Input() getScheduleInstanceDates?: () => string[];
  @Input() getDateDisplayText?: (date: any) => string;

  @Output() onClose = new EventEmitter<void>();
  @Output() onUpdate = new EventEmitter<{
    name: string;
    startTime: string;
    endTime: string;
    targetHours: number;
  }>();
  @Output() staffSearchQueryChange = new EventEmitter<string>();
  @Output() showStaffDropdownChange = new EventEmitter<boolean>();
  @Output() filterStaffList = new EventEmitter<void>();
  @Output() addStaffToAssignment = new EventEmitter<any>();
  @Output() editStaffAssignment = new EventEmitter<number>();
  @Output() removeStaffAssignment = new EventEmitter<number>();
  @Output() cancelStaffAssignmentForm = new EventEmitter<void>();
  @Output() saveStaffAssignmentForm = new EventEmitter<void>();
  @Output() publishDraftAssignmentRules = new EventEmitter<void>();
  @Output() closeStaffAssignmentModal = new EventEmitter<void>();
  @Output() staffAssignmentFieldChange = new EventEmitter<{ field: string; value: any }>();
  @Output() startNewStaffAssignment = new EventEmitter<void>();

  isClosing = false;
  updateForm: FormGroup;
  private wasVisible = false;
  assignUntilCalendarOpen = false;
  assignUntilViewDate = new Date();
  assignFromCalendarOpen = false;
  assignFromViewDate = new Date();
  showStaffMemberRequiredError = false;
  showStartTimeRequiredError = false;
  showEndTimeRequiredError = false;
  selectedStaffTimeOffRequests: any[] = [];
  timeOffTooltip: { request: any; assignment: any; left: number; top: number } | null = null;
  @ViewChild('timeOffTooltip') private timeOffTooltipRef?: ElementRef<HTMLElement>;

  getUpdatedByNameForSchedule(schedule: any): string {
    const updatedBy = schedule?.updatedBy;
    if (typeof updatedBy !== 'number') return '';
    if (typeof this.getStaffName !== 'function') return '';
    return (this.getStaffName(updatedBy) || '').toString().trim();
  }

  get timeInputMin(): string | null {
    const window = this.getShiftWindowForAssignment();
    if (!window) return null;
    if (this.isOvernightWindow(window.startTime, window.endTime)) return null;
    return window.startTime;
  }

  get timeInputMax(): string | null {
    const window = this.getShiftWindowForAssignment();
    if (!window) return null;
    if (this.isOvernightWindow(window.startTime, window.endTime)) return null;
    return window.endTime;
  }

  get assignmentHeaderDate(): string | null {
    const occurrenceDate = this.getSingleOccurrenceDateForAssignment?.();
    if (occurrenceDate instanceof Date && !isNaN(occurrenceDate.getTime())) {
      return this.formatDateAsLocalString(occurrenceDate);
    }
    if (typeof occurrenceDate === 'string' && occurrenceDate.trim()) {
      return occurrenceDate.trim();
    }
    if (this.selectedSchedule?.overrideSourceDate) {
      return this.selectedSchedule.overrideSourceDate;
    }
    return this.selectedSchedule?.dtStartLocal || null;
  }

  get assignmentHeaderDateRangeLabel(): string | null {
    const source = this.getRangeDisplayAssignment();
    const from =
      source?.displayEffectiveFrom ||
      source?.effectiveFrom ||
      this.assignmentHeaderDate;
    const to =
      source?.displayEffectiveTo || source?.effectiveTo || null;
    if (!from) return null;

    const fromLabel = this.getFormattedDateLabel(from);
    const toLabel = to ? this.getFormattedDateLabel(to) : null;
    if (!fromLabel) return null;
    if (!toLabel || toLabel === fromLabel) return fromLabel;
    return `${fromLabel} - ${toLabel}`;
  }

  constructor(private fb: FormBuilder, private modalState: ModalStateService) {
    this.updateForm = this.fb.group({
      name: [''],
      startTime: [''],
      endTime: [''],
      targetHours: [8]
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']) {
      const nextVisible = !!changes['visible'].currentValue;
      this.handleVisibilityChange(nextVisible);
    }
    if (changes['showName'] || changes['requireName']) {
      this.setControlValidators('name', this.showName, this.requireName ? [Validators.required, Validators.minLength(1)] : []);
    }
    if (changes['showStartTime'] || changes['requireStartTime']) {
      this.setControlValidators('startTime', this.showStartTime, this.requireStartTime ? [Validators.required] : []);
    }
    if (changes['showEndTime'] || changes['requireEndTime']) {
      this.setControlValidators('endTime', this.showEndTime, this.requireEndTime ? [Validators.required] : []);
    }
    if (changes['showTargetHours'] || changes['requireTargetHours']) {
      this.setControlValidators('targetHours', this.showTargetHours, this.requireTargetHours ? [Validators.required, Validators.min(0.5)] : []);
    }
    if (changes['shift'] && this.shift) {
      this.updateForm.patchValue({
        name: this.shift.name || '',
        targetHours: this.shift.targetHours || 8,
        startTime: this.formatTimeForInput(this.shift.startTime),
        endTime: this.formatTimeForInput(this.shift.endTime)
      });
    }

    if (changes['timeOffRequests'] || changes['currentStaffAssignment']) {
      this.updateSelectedStaffTimeOffRequests();
    }

    if (changes['visible'] || changes['currentStaffAssignment'] || changes['newStaffAssignment']) {
      this.ensureDefaultAssignUntil();
    }

    if ((changes['currentStaffAssignment'] && this.currentStaffAssignment) || (changes['newStaffAssignment'] && !this.newStaffAssignment)) {
      if (this.hasSelectedStaffMember()) {
        this.showStaffMemberRequiredError = false;
      }
      if (this.hasStartTime()) {
        this.showStartTimeRequiredError = false;
      }
      if (this.hasEndTime()) {
        this.showEndTimeRequiredError = false;
      }
    }
  }

  getTimeOffChipText(request: any): string {
    const type = (request?.timeOffType || request?.jobCode || request?.status || 'Time Off').toString();
    const startText = this.formatDateForTimeOff(request?.startDate);
    const endText = this.formatDateForTimeOff(request?.endDate);
    if (!startText && !endText) return type;
    if (startText && (!endText || endText === startText)) return `${type}: ${startText}`;
    return `${type}: ${startText} - ${endText}`;
  }

  getTimeOffBadgeForAssignment(assignment: any): any | null {
    const staffId = assignment?.staffId;
    if (!staffId) return null;

    const staffRequests = (this.timeOffRequests || [])
      .filter((r) => Number(r?.staffId) === Number(staffId))
      .slice()
      .sort((a, b) => {
        const aStart = this.toDateStartOfDay(a?.startDate)?.getTime() ?? 0;
        const bStart = this.toDateStartOfDay(b?.startDate)?.getTime() ?? 0;
        return aStart - bStart;
      });

    if (staffRequests.length === 0) return null;

    const assignmentStart = this.toDateStartOfDay(assignment?.effectiveFrom);
    const assignmentEnd = assignment?.effectiveTo
      ? this.toDateEndOfDay(assignment?.effectiveTo)
      : null;

    const cutoff = assignmentStart || this.toDateStartOfDay(new Date());

    const overlapping = assignmentStart && assignmentEnd
      ? staffRequests.filter((r) => this.overlapsDateRange(r, assignmentStart, assignmentEnd))
      : assignmentStart
          ? staffRequests.filter((r) => {
              const reqEnd = this.toDateEndOfDay(r?.endDate || r?.startDate);
              if (!reqEnd) return false;
              return reqEnd.getTime() >= assignmentStart.getTime();
            })
          : staffRequests;

    const upcoming = overlapping.filter((r) => {
      if (!cutoff) return true;
      const reqEnd = this.toDateEndOfDay(r?.endDate || r?.startDate);
      if (!reqEnd) return false;
      return reqEnd.getTime() >= cutoff.getTime();
    });

    const timeFiltered = this.filterByTimeOverlapWhenApplicable(upcoming, assignment);
    return timeFiltered[0] ?? upcoming[0] ?? null;
  }

  getTimeOffBadgeText(request: any): string {
    const hours = this.formatHoursAsBadge(request?.totalHours);
    const type = this.normalizeTimeOffTypeLabel(request?.timeOffType || request?.jobCode || 'Time Off');
    if (!hours) return type;
    return `${hours} ${type}`;
  }

  getTimeOffTypeLabel(request: any): string {
    return this.normalizeTimeOffTypeLabel(request?.timeOffType || request?.jobCode || 'Time Off');
  }

  getTimeOffDurationText(request: any): string {
    const n = Number(request?.totalHours);
    if (!Number.isFinite(n) || n <= 0) return 'N/A';
    const rounded = Math.round(n * 10) / 10;
    const label = rounded === 1 ? 'hour' : 'hours';
    const text = Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
    return `${text} ${label}`;
  }

  getTimeOffStatusLabel(request: any): string {
    const numeric = this.getTimeOffStatusNumeric(request);
    if (numeric === 0) return 'Unapproved';
    if (numeric === 1) return 'Approved';
    const raw = (request?.status ?? request?.timeOffStatus ?? 'N/A').toString();
    return raw || 'N/A';
  }

  getTimeOffStatusClasses(requestOrStatus: any): string {
    const numeric = typeof requestOrStatus === 'object' ? this.getTimeOffStatusNumeric(requestOrStatus) : null;
    if (numeric === 0) return 'bg-rose-100 text-rose-700';
    if (numeric === 1) return 'bg-emerald-100 text-emerald-700';

    const raw = (requestOrStatus ?? '').toString().toLowerCase();
    if (raw === '0') return 'bg-rose-100 text-rose-700';
    if (raw === '1') return 'bg-emerald-100 text-emerald-700';
    if (raw.includes('approved')) return 'bg-emerald-100 text-emerald-700';
    if (raw.includes('reject') || raw.includes('denied')) return 'bg-rose-100 text-rose-700';
    if (raw.includes('cancel')) return 'bg-slate-100 text-slate-700';
    if (raw.includes('open') || raw.includes('pending')) return 'bg-slate-100 text-slate-700';
    return 'bg-slate-100 text-slate-700';
  }

  private getTimeOffStatusNumeric(request: any): 0 | 1 | null {
    const candidate = request?.timeOffStatus ?? request?.status;
    const n = Number(candidate);
    if (n === 0) return 0;
    if (n === 1) return 1;
    return null;
  }

  formatTimeOffDate(value: any): string {
    return this.formatDateForTimeOff(value);
  }

  toHHmmSafe(timeStr: any): string {
    return this.toHHmm(typeof timeStr === 'string' ? timeStr : null);
  }

  getTimeOffShiftTimeStart(request: any, assignment: any): string {
    return this.toHHmmSafe(request?.startTime) || this.toHHmmSafe(assignment?.startTime);
  }

  getTimeOffShiftTimeEnd(request: any, assignment: any): string {
    return this.toHHmmSafe(request?.endTime) || this.toHHmmSafe(assignment?.endTime);
  }

  getTimeOffBadgeClasses(request: any): string {
    const type = (request?.timeOffType || request?.jobCode || '').toString().toLowerCase();
    if (type.includes('sick')) return 'bg-rose-100 text-rose-700';
    if (type.includes('vac')) return 'bg-amber-100 text-amber-800';
    if (type.includes('pto')) return 'bg-violet-100 text-violet-700';
    if (type.includes('lwop')) return 'bg-slate-200 text-slate-800 ring-1 ring-slate-300/60';
    if (type.includes('holiday')) return 'bg-sky-100 text-sky-700';
    return 'bg-slate-100 text-slate-700';
  }

  openTimeOffTooltip(event: MouseEvent, request: any, assignment: any): void {
    const anchor = event.currentTarget as HTMLElement | null;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

    // Initial placement (refined after measurement).
    const estimatedWidth = 320;
    const left = this.clamp(rect.right - estimatedWidth, 8, Math.max(8, viewportWidth - estimatedWidth - 8));
    const top = this.clamp(rect.bottom + 8, 8, Math.max(8, viewportHeight - 8));

    this.timeOffTooltip = { request, assignment, left, top };

    setTimeout(() => this.repositionTimeOffTooltip(rect), 0);
  }

  closeTimeOffTooltip(): void {
    this.timeOffTooltip = null;
  }

  readonly trackByTimeOffId = (_index: number, item: any): string | number => {
    return item?.timeOffId ?? item?.id ?? _index;
  };

  private updateSelectedStaffTimeOffRequests(): void {
    const staffId = this.currentStaffAssignment?.staffId;
    if (!staffId) {
      this.selectedStaffTimeOffRequests = [];
      return;
    }

    const staffRequests = (this.timeOffRequests || []).filter(
      (r) => Number(r?.staffId) === Number(staffId),
    );

    const effectiveFrom = this.currentStaffAssignment?.effectiveFrom;
    const cutoff = this.toDateStartOfDay(effectiveFrom) || this.toDateStartOfDay(new Date());

    this.selectedStaffTimeOffRequests = staffRequests
      .filter((r) => {
        if (!cutoff) return true;
        const reqEnd = this.toDateEndOfDay(r?.endDate || r?.startDate);
        if (!reqEnd) return false;
        return reqEnd.getTime() >= cutoff.getTime();
      })
      .slice()
      .sort((a, b) => {
        const aStart = this.toDateStartOfDay(a?.startDate)?.getTime() ?? 0;
        const bStart = this.toDateStartOfDay(b?.startDate)?.getTime() ?? 0;
        return aStart - bStart;
      });
  }

  private overlapsDateRange(request: any, rangeStart: Date, rangeEnd: Date): boolean {
    const reqStart = this.toDateStartOfDay(request?.startDate);
    const reqEnd = this.toDateEndOfDay(request?.endDate || request?.startDate);
    if (!reqStart || !reqEnd) return false;
    return reqStart.getTime() <= rangeEnd.getTime() && reqEnd.getTime() >= rangeStart.getTime();
  }

  private repositionTimeOffTooltip(anchorRect: DOMRect): void {
    if (!this.timeOffTooltip) return;

    const tooltipEl = this.timeOffTooltipRef?.nativeElement;
    const tooltipRect = tooltipEl?.getBoundingClientRect();
    const tooltipWidth = tooltipRect?.width || 320;
    const tooltipHeight = tooltipRect?.height || 200;

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

    const left = this.clamp(
      anchorRect.right - tooltipWidth,
      8,
      Math.max(8, viewportWidth - tooltipWidth - 8),
    );

    const topAbove = anchorRect.top - 8 - tooltipHeight;
    const topBelow = anchorRect.bottom + 8;
    const top = topAbove >= 8
      ? topAbove
      : this.clamp(topBelow, 8, Math.max(8, viewportHeight - tooltipHeight - 8));

    this.timeOffTooltip = { ...this.timeOffTooltip, left, top };
  }

  private clamp(value: number, min: number, max: number): number {
    if (max < min) return min;
    return Math.min(max, Math.max(min, value));
  }

  private formatHoursAsBadge(hours: any): string {
    const n = Number(hours);
    if (!Number.isFinite(n) || n <= 0) return '';
    const rounded = Math.round(n * 10) / 10;
    const text = Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
    return `${text}h`;
  }

  private normalizeTimeOffTypeLabel(value: any): string {
    const raw = (value ?? '').toString().trim();
    if (!raw) return 'Time Off';
    if (raw.toLowerCase() === 'sick') return 'Sick Leave';
    if (raw.toLowerCase() === 'vacation') return 'Vacation';
    return raw;
  }

  private filterByTimeOverlapWhenApplicable(requests: any[], assignment: any): any[] {
    const assignmentDateIso = this.getLocalDateIso(assignment?.effectiveFrom);
    if (!assignmentDateIso) return requests;

    const assignmentStart = this.toHHmm(assignment?.startTime);
    const assignmentEnd = this.toHHmm(assignment?.endTime);
    if (!assignmentStart || !assignmentEnd) return requests;
    if (this.isOvernightWindow(assignmentStart, assignmentEnd)) return requests;

    const assignmentStartMin = this.parseTimeToMinutes(assignmentStart);
    const assignmentEndMin = this.parseTimeToMinutes(assignmentEnd);
    if (assignmentEndMin <= assignmentStartMin) return requests;

    const filtered = requests.filter((r) => {
      const reqStartIso = this.getLocalDateIso(r?.startDate);
      const reqEndIso = this.getLocalDateIso(r?.endDate || r?.startDate);
      if (!reqStartIso || !reqEndIso) return false;
      if (reqStartIso !== assignmentDateIso || reqEndIso !== assignmentDateIso) return true; // multi-day: keep

      const reqStart = this.toHHmm(r?.startTime);
      const reqEnd = this.toHHmm(r?.endTime);
      if (!reqStart || !reqEnd) return true; // no time info: keep
      if (this.isOvernightWindow(reqStart, reqEnd)) return true;

      const reqStartMin = this.parseTimeToMinutes(reqStart);
      const reqEndMin = this.parseTimeToMinutes(reqEnd);
      if (reqEndMin <= reqStartMin) return true;

      return reqStartMin < assignmentEndMin && reqEndMin > assignmentStartMin;
    });

    return filtered.length > 0 ? filtered : requests;
  }

  private formatDateForTimeOff(value: any): string {
    if (!value) return '';
    if (this.formatDateForDisplay) return this.formatDateForDisplay(value);
    const d = this.parseAnyDate(value);
    if (!d) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private toDateStartOfDay(value: any): Date | null {
    const d = this.parseAnyDate(value);
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  }

  private toDateEndOfDay(value: any): Date | null {
    const d = this.parseAnyDate(value);
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  }

  private parseAnyDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
      if (m) {
        const year = Number(m[1]);
        const monthIndex = Number(m[2]) - 1;
        const day = Number(m[3]);
        if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null;
        const d = new Date(year, monthIndex, day);
        return isNaN(d.getTime()) ? null : d;
      }
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  private getLocalDateIso(value: any): string | null {
    const d = this.parseAnyDate(value);
    if (!d) return null;
    return this.formatDateAsLocalString(d);
  }

  private handleVisibilityChange(visible: boolean): void {
    if (visible && !this.wasVisible) {
      this.modalState.open();
      this.closeAssignmentCalendars();
    }
    if (!visible && this.wasVisible) {
      this.modalState.close();
    }
    if (!visible) {
      this.closeAssignmentCalendars();
      this.closeTimeOffTooltip();
      this.showStaffMemberRequiredError = false;
      this.showStartTimeRequiredError = false;
      this.showEndTimeRequiredError = false;
    }
    this.wasVisible = visible;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.visible) return;
    if (!this.assignUntilCalendarOpen && !this.assignFromCalendarOpen) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('.assign-until-picker')) return;

    this.closeAssignmentCalendars();
  }

  private closeAssignmentCalendars(): void {
    this.assignUntilCalendarOpen = false;
    this.assignFromCalendarOpen = false;
  }

  private ensureDefaultAssignUntil(): void {
    if (!this.visible) return;
    if (!this.useStaffAssignmentForm) return;
    if (!this.newStaffAssignment) return;
    if (this.isOvernightShift) return;

    const current = this.currentStaffAssignment;
    if (!current) return;
    if (current.effectiveTo) return;

    const isoFromHelper = this.getLocalDateIso(this.getSingleOccurrenceDateForAssignment?.());
    const isoFromEffectiveFrom = this.getLocalDateIso(current.effectiveFrom);
    const scheduleInstanceDates = (this.getScheduleInstanceDates?.() || []).filter(Boolean);
    const isoFromSingleInstance = scheduleInstanceDates.length === 1 ? scheduleInstanceDates[0] : null;

    const targetIso = isoFromHelper || isoFromEffectiveFrom || isoFromSingleInstance;
    if (!targetIso) return;

    this.staffAssignmentFieldChange.emit({ field: 'effectiveTo', value: targetIso });
  }

  private hasSelectedStaffMember(): boolean {
    const staffId = this.currentStaffAssignment?.staffId;
    return typeof staffId === 'number' && Number.isFinite(staffId);
  }

  private hasStartTime(): boolean {
    return typeof this.currentStaffAssignment?.startTime === 'string' && this.currentStaffAssignment.startTime.trim().length > 0;
  }

  private hasEndTime(): boolean {
    return typeof this.currentStaffAssignment?.endTime === 'string' && this.currentStaffAssignment.endTime.trim().length > 0;
  }

  onStaffSearchQueryChange(value: string): void {
    this.showStaffMemberRequiredError = false;
    this.staffSearchQueryChange.emit(value);
  }

  onStaffInputFocus(): void {
    this.showStaffMemberRequiredError = false;
    this.showStaffDropdownChange.emit(true);
  }

  onStaffSelected(staff: any): void {
    this.showStaffMemberRequiredError = false;
    this.addStaffToAssignment.emit(staff);
  }

  onStaffAssignmentTimeChange(field: 'startTime' | 'endTime', value: any): void {
    if (field === 'startTime') {
      this.showStartTimeRequiredError = false;
    }
    if (field === 'endTime') {
      this.showEndTimeRequiredError = false;
    }
    this.staffAssignmentFieldChange.emit({ field, value });
  }

  onCancelStaffAssignmentForm(): void {
    this.showStaffMemberRequiredError = false;
    this.showStartTimeRequiredError = false;
    this.showEndTimeRequiredError = false;
    this.cancelStaffAssignmentForm.emit();
  }

  onStartNewStaffAssignment(): void {
    this.showStaffMemberRequiredError = false;
    this.showStartTimeRequiredError = false;
    this.showEndTimeRequiredError = false;
    this.startNewStaffAssignment.emit();
  }

  onSaveStaffAssignment(): void {
    const hasStaff = this.hasSelectedStaffMember();
    const hasStartTime = this.hasStartTime();
    const hasEndTime = this.hasEndTime();

    this.showStaffMemberRequiredError = !hasStaff;
    this.showStartTimeRequiredError = !hasStartTime;
    this.showEndTimeRequiredError = !hasEndTime;

    if (!hasStaff) {
      this.showStaffDropdownChange.emit(true);
    }

    if (!hasStaff || !hasStartTime || !hasEndTime) {
      return;
    }

    this.saveStaffAssignmentForm.emit();
  }

  private getRangeDisplayAssignment(): any | null {
    if (
      this.editingStaffAssignmentIndex !== null &&
      this.editingStaffAssignmentIndex >= 0 &&
      this.editingStaffAssignmentIndex < this.staffAssignments.length
    ) {
      return this.staffAssignments[this.editingStaffAssignmentIndex];
    }

    if (
      !this.newStaffAssignment &&
      this.staffAssignments.length === 1 &&
      !(typeof this.currentStaffAssignment?.staffId === 'number')
    ) {
      return this.staffAssignments[0];
    }

    if (
      this.currentStaffAssignment &&
      (
        typeof this.currentStaffAssignment.staffId === 'number' ||
        this.newStaffAssignment ||
        this.currentStaffAssignment.effectiveFrom ||
        this.currentStaffAssignment.effectiveTo
      )
    ) {
      return this.currentStaffAssignment;
    }

    return null;
  }

  private getFormattedDateLabel(value: any): string {
    if (!value) return '';
    if (this.formatDateForDisplay) return this.formatDateForDisplay(value);
    const d = this.parseAnyDate(value);
    if (!d) return '';
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  }

  close(): void {
    if (this.isClosing) return;
    this.isClosing = true;
    this.closeTimeOffTooltip();
    setTimeout(() => {
      this.visible = false;
      if (this.wasVisible) {
        this.modalState.close();
        this.wasVisible = false;
      }
      this.isClosing = false;
      this.onClose.emit();
    }, this.closeAnimationMs);
  }

  submit(): void {
    if (this.updateForm.invalid || this.isSaving) {
      this.updateForm.markAllAsTouched();
      return;
    }
    const value = this.updateForm.value;
    this.onUpdate.emit({
      name: value.name,
      startTime: value.startTime,
      endTime: value.endTime,
      targetHours: Number(value.targetHours)
    });
  }

  getStaffInitials(name?: string | null): string {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '??';
    const first = parts[0][0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] || '' : '';
    const initials = (first + last).toUpperCase();
    return initials || '??';
  }

  private formatTimeForInput(timeString: string | null | undefined): string {
    if (!timeString) return '09:00';
    try {
      const [hours, minutes] = timeString.split(':');
      return `${hours}:${minutes || '00'}`;
    } catch {
      return '09:00';
    }
  }

  private setControlValidators(
    controlName: string,
    isVisible: boolean,
    validators: any[]
  ): void {
    const control = this.updateForm.get(controlName);
    if (!control) return;
    if (!isVisible) {
      control.clearValidators();
      control.markAsPristine();
      control.markAsUntouched();
    } else {
      control.setValidators(validators);
    }
    control.updateValueAndValidity();
  }

  toggleAssignUntilCalendar(): void {
    this.assignUntilCalendarOpen = !this.assignUntilCalendarOpen;
    if (this.assignUntilCalendarOpen) {
      this.assignFromCalendarOpen = false;
      this.assignUntilViewDate = this.getInitialCalendarMonth(
        this.currentStaffAssignment?.effectiveTo || this.currentStaffAssignment?.effectiveFrom,
      );
    }
  }

  toggleAssignFromCalendar(): void {
    this.assignFromCalendarOpen = !this.assignFromCalendarOpen;
    if (this.assignFromCalendarOpen) {
      this.assignUntilCalendarOpen = false;
      this.assignFromViewDate = this.getInitialCalendarMonth(
        this.currentStaffAssignment?.effectiveFrom || this.currentStaffAssignment?.effectiveTo,
      );
    }
  }

  closeAssignFromCalendar(): void {
    this.assignFromCalendarOpen = false;
  }

  closeAssignUntilCalendar(): void {
    this.assignUntilCalendarOpen = false;
  }

  clearAssignUntilDate(): void {
    this.staffAssignmentFieldChange.emit({ field: 'effectiveTo', value: null });
  }

  goAssignUntilPrevMonth(): void {
    const d = new Date(this.assignUntilViewDate);
    d.setMonth(d.getMonth() - 1);
    this.assignUntilViewDate = d;
  }

  goAssignUntilNextMonth(): void {
    const d = new Date(this.assignUntilViewDate);
    d.setMonth(d.getMonth() + 1);
    this.assignUntilViewDate = d;
  }

  goAssignFromPrevMonth(): void {
    const d = new Date(this.assignFromViewDate);
    d.setMonth(d.getMonth() - 1);
    this.assignFromViewDate = d;
  }

  goAssignFromNextMonth(): void {
    const d = new Date(this.assignFromViewDate);
    d.setMonth(d.getMonth() + 1);
    this.assignFromViewDate = d;
  }

  getAssignUntilMonthLabel(): string {
    const d = this.assignUntilViewDate;
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  getAssignFromMonthLabel(): string {
    const d = this.assignFromViewDate;
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  getAssignUntilCalendarDays(): Array<{ date: Date; iso: string; inMonth: boolean; enabled: boolean }> {
    const year = this.assignUntilViewDate.getFullYear();
    const month = this.assignUntilViewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startDay = firstOfMonth.getDay();
    const start = new Date(year, month, 1 - startDay);
    const allowed = new Set(this.getAllowedAssignmentDates());
    const minDate = this.currentStaffAssignment?.effectiveFrom || '';

    const days: Array<{ date: Date; iso: string; inMonth: boolean; enabled: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = this.formatDateAsLocalString(date);
      const inMonth = date.getMonth() === month;
      const enabledByMin = !minDate || iso >= minDate;
      const enabledByAllowed = allowed.size === 0 || allowed.has(iso);
      days.push({
        date,
        iso,
        inMonth,
        enabled: enabledByMin && enabledByAllowed
      });
    }
    return days;
  }

  getAssignFromCalendarDays(): Array<{ date: Date; iso: string; inMonth: boolean; enabled: boolean }> {
    const year = this.assignFromViewDate.getFullYear();
    const month = this.assignFromViewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startDay = firstOfMonth.getDay();
    const start = new Date(year, month, 1 - startDay);
    const allowed = new Set(this.getAllowedAssignmentDates());
    const maxDate = this.currentStaffAssignment?.effectiveTo || '';

    const days: Array<{ date: Date; iso: string; inMonth: boolean; enabled: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = this.formatDateAsLocalString(date);
      const inMonth = date.getMonth() === month;
      const enabledByMax = !maxDate || iso <= maxDate;
      const enabledByAllowed = allowed.size === 0 || allowed.has(iso);
      days.push({
        date,
        iso,
        inMonth,
        enabled: enabledByMax && enabledByAllowed
      });
    }
    return days;
  }

  selectAssignUntilDate(iso: string): void {
    const allowed = new Set(this.getAllowedAssignmentDates());
    if (allowed.size > 0 && !allowed.has(iso)) return;
    const minDate = this.currentStaffAssignment?.effectiveFrom || '';
    if (minDate && iso < minDate) return;
    this.staffAssignmentFieldChange.emit({ field: 'effectiveTo', value: iso });
    this.assignUntilCalendarOpen = false;
  }

  selectAssignFromDate(iso: string): void {
    const allowed = new Set(this.getAllowedAssignmentDates());
    if (allowed.size > 0 && !allowed.has(iso)) return;
    const maxDate = this.currentStaffAssignment?.effectiveTo || '';
    if (maxDate && iso > maxDate) return;
    this.staffAssignmentFieldChange.emit({ field: 'effectiveFrom', value: iso });

    if (this.isOvernightShift) {
      const currentTo = this.currentStaffAssignment?.effectiveTo;
      if (!currentTo || currentTo < iso) {
        const d = new Date(iso);
        if (!isNaN(d.getTime())) {
          d.setDate(d.getDate() + 1);
          this.staffAssignmentFieldChange.emit({ field: 'effectiveTo', value: this.formatDateAsLocalString(d) });
        }
      }
    }

    this.assignFromCalendarOpen = false;
  }

  getAssignUntilDisplayText(): string {
    const source = this.getRangeDisplayAssignment();
    const value =
      source?.displayEffectiveTo ||
      source?.effectiveTo ||
      this.currentStaffAssignment?.effectiveTo;
    if (!value) return 'End date (optional)';
    if (this.getDateDisplayText) {
      return this.getDateDisplayText(value);
    }
    if (this.formatDateForDisplay) {
      return this.formatDateForDisplay(value);
    }
    return value;
  }

  getAssignFromDisplayText(): string {
    const source = this.getRangeDisplayAssignment();
    const value =
      source?.displayEffectiveFrom ||
      source?.effectiveFrom ||
      this.currentStaffAssignment?.effectiveFrom;
    if (!value) return 'Start date';
    if (this.getDateDisplayText) {
      return this.getDateDisplayText(value);
    }
    if (this.formatDateForDisplay) {
      return this.formatDateForDisplay(value);
    }
    return value;
  }

  private formatDateAsLocalString(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toHHmm(timeStr: string | null | undefined): string {
    if (!timeStr) return '';
    return timeStr.length >= 5 ? timeStr.substring(0, 5) : timeStr;
  }

  private getShiftWindowForAssignment(): { startTime: string; endTime: string } | null {
    const start = this.toHHmm(this.selectedShift?.startTime);
    const end = this.toHHmm(this.selectedShift?.endTime);
    if (!start || !end) return null;
    return { startTime: start, endTime: end };
  }

  private parseTimeToMinutes(timeStr: string | null | undefined): number {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    const h = parseInt(parts[0] || '0', 10);
    const m = parseInt(parts[1] || '0', 10);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  }

  private isOvernightWindow(startTime: string, endTime: string): boolean {
    const startMinutes = this.parseTimeToMinutes(startTime);
    const endMinutes = this.parseTimeToMinutes(endTime);
    return endMinutes <= startMinutes;
  }

  private getInitialCalendarMonth(preferredIso?: string | null): Date {
    const preferred = preferredIso ? this.parseAnyDate(preferredIso) : null;
    if (preferred) {
      return new Date(preferred.getFullYear(), preferred.getMonth(), 1);
    }

    const firstAllowedIso = this.getAllowedAssignmentDates()[0];
    const firstAllowed = firstAllowedIso ? this.parseAnyDate(firstAllowedIso) : null;
    if (firstAllowed) {
      return new Date(firstAllowed.getFullYear(), firstAllowed.getMonth(), 1);
    }

    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  private getAllowedAssignmentDates(): string[] {
    const providedDates = (this.getScheduleInstanceDates?.() || [])
      .filter((date): date is string => typeof date === 'string' && !!date.trim())
      .map((date) => date.trim());

    if (providedDates.length > 0) {
      return Array.from(new Set(providedDates)).sort();
    }

    const derivedDates = this.buildOccurrenceDatesFromSelectedSchedule();
    if (derivedDates.length > 0) return derivedDates;

    return [];
  }

  private buildOccurrenceDatesFromSelectedSchedule(): string[] {
    const schedule = this.selectedSchedule;
    if (!schedule?.dtStartLocal) return [];

    const startDate = this.parseAnyDate(schedule.dtStartLocal);
    if (!startDate) return [];

    const rRule = String(schedule.rRule || schedule.rrule || '').trim().toUpperCase();
    const startIso = this.formatDateAsLocalString(startDate);
    const exclusionDates = this.getExclusionDates(schedule);

    const isSingleOccurrenceOverride =
      !!schedule.overrideSourceDate &&
      (rRule.includes('COUNT=1') || (schedule.until && schedule.until === startIso));

    if (isSingleOccurrenceOverride || rRule.includes('COUNT=1') || !rRule) {
      return exclusionDates.has(startIso) ? [] : [startIso];
    }

    const untilValue = typeof schedule.until === 'string' && schedule.until.trim()
      ? schedule.until.trim()
      : null;
    const endDate = untilValue
      ? this.parseAnyDate(`${untilValue}T23:59:59.999`)
      : new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    if (!endDate) return exclusionDates.has(startIso) ? [] : [startIso];

    const ruleParts = this.parseRRuleParts(rRule);
    const occurrences: string[] = [];
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

    while (cursor <= endDate && occurrences.length < 366) {
      const iso = this.formatDateAsLocalString(cursor);
      if (!exclusionDates.has(iso) && this.matchesRRuleDate(cursor, startDate, ruleParts)) {
        occurrences.push(iso);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return occurrences;
  }

  private getExclusionDates(schedule: any): Set<string> {
    const raw = schedule?.exDate ?? schedule?.exdate;
    if (!raw) return new Set<string>();

    const values = Array.isArray(raw)
      ? raw
      : typeof raw === 'string'
        ? raw.replace(/[{}"]/g, '').split(',').map((part) => part.trim()).filter(Boolean)
        : [];

    return new Set(
      values
        .map((value: string) => value.includes('T') ? value.substring(0, 10) : value)
        .filter((value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)),
    );
  }

  private parseRRuleParts(rRule: string): Map<string, string> {
    const parts = new Map<string, string>();
    rRule.split(';').forEach((part) => {
      const [key, value] = part.split('=');
      if (key && value) parts.set(key.toUpperCase(), value.toUpperCase());
    });
    return parts;
  }

  private matchesRRuleDate(date: Date, startDate: Date, ruleParts: Map<string, string>): boolean {
    const freq = ruleParts.get('FREQ');
    if (!freq) return this.isSameLocalDay(date, startDate);

    const interval = Math.max(1, Number(ruleParts.get('INTERVAL') || '1'));
    const byDay = (ruleParts.get('BYDAY') || '').split(',').filter(Boolean);
    const byMonthDay = (ruleParts.get('BYMONTHDAY') || '')
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value !== 0);
    const byMonth = (ruleParts.get('BYMONTH') || '')
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 12);

    switch (freq) {
      case 'DAILY':
        return this.getDayDifference(startDate, date) % interval === 0;
      case 'WEEKLY': {
        const weekDiff = Math.floor(this.getDayDifference(startDate, date) / 7);
        if (weekDiff < 0 || weekDiff % interval !== 0) return false;
        if (byDay.length === 0) return date.getDay() === startDate.getDay();
        return byDay.includes(this.getWeekdayCode(date));
      }
      case 'MONTHLY': {
        const monthDiff = this.getMonthDifference(startDate, date);
        if (monthDiff < 0 || monthDiff % interval !== 0) return false;
        if (byMonthDay.length > 0) {
          return byMonthDay.some((day) => this.matchesMonthDay(date, day));
        }
        if (byDay.length > 0) {
          return byDay.some((value) => this.matchesOrdinalWeekday(date, value));
        }
        return date.getDate() === startDate.getDate();
      }
      case 'YEARLY': {
        const yearDiff = date.getFullYear() - startDate.getFullYear();
        if (yearDiff < 0 || yearDiff % interval !== 0) return false;
        if (byMonth.length > 0 && !byMonth.includes(date.getMonth() + 1)) return false;
        if (byMonthDay.length > 0) {
          return byMonthDay.some((day) => this.matchesMonthDay(date, day));
        }
        return date.getMonth() === startDate.getMonth() && date.getDate() === startDate.getDate();
      }
      default:
        return this.isSameLocalDay(date, startDate);
    }
  }

  private getDayDifference(startDate: Date, endDate: Date): number {
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
    return Math.floor((end - start) / (24 * 60 * 60 * 1000));
  }

  private getMonthDifference(startDate: Date, endDate: Date): number {
    return (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
  }

  private isSameLocalDay(left: Date, right: Date): boolean {
    return left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth()
      && left.getDate() === right.getDate();
  }

  private getWeekdayCode(date: Date): string {
    return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][date.getDay()];
  }

  private matchesMonthDay(date: Date, monthDay: number): boolean {
    if (monthDay > 0) return date.getDate() === monthDay;
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return date.getDate() === lastDayOfMonth + monthDay + 1;
  }

  private matchesOrdinalWeekday(date: Date, byDayValue: string): boolean {
    const match = byDayValue.match(/^([+-]?\d)?(SU|MO|TU|WE|TH|FR|SA)$/);
    if (!match) return false;

    const ordinal = match[1] ? Number(match[1]) : null;
    const weekday = match[2];
    if (this.getWeekdayCode(date) !== weekday) return false;
    if (ordinal === null) return true;

    const occurrenceIndex = Math.floor((date.getDate() - 1) / 7) + 1;
    if (ordinal > 0) return occurrenceIndex === ordinal;

    const lastMatchingDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    while (this.getWeekdayCode(lastMatchingDate) !== weekday) {
      lastMatchingDate.setDate(lastMatchingDate.getDate() - 1);
    }

    if (ordinal === -1) return date.getDate() === lastMatchingDate.getDate();
    const target = new Date(lastMatchingDate);
    target.setDate(target.getDate() + (ordinal + 1) * 7);
    return date.getDate() === target.getDate();
  }
}
