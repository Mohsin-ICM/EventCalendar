import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IcmDropdownComponent } from '../icm-dropdown/icm-dropdown.component';
import { ModalStateService } from '../../services/modal-state.service';
import { TimeFormatPipe } from '../../../shared/pipes/time-format.pipe';
import { IcmDateTimePipe } from '../../../shared/pipes/icm-date-time.pipe';

@Component({
  selector: 'icm-create-popup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IcmDropdownComponent, TimeFormatPipe, IcmDateTimePipe],
  templateUrl: './icm-create-popup.component.html',
  styleUrls: ['./icm-create-popup.component.css']
})
export class IcmCreatePopupComponent implements OnChanges {
  readonly weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  private readonly weekdayIndices = [1, 2, 3, 4, 5];
  @Input() header: string = 'Create';
  @Input() subHeader: string = '';
  @Input() icon: string = 'bi bi-plus-circle';
  @Input() visible: boolean = false;
  @Input() showCloseButton: boolean = true;
  @Input() showAssigningTo = true;
  @Input() closeAnimationMs: number = 200;
  @Input() panelClass: string = '';
  @Input() isSaving = false;
  @Input() useDefaultForm = true;
  @Input() defaultStartTime: string = '09:00';
  @Input() defaultEndTime: string = '17:00';
  @Input() defaultTargetHours: number = 8;
  @Input() showName = false;
  @Input() showStartTime = false;
  @Input() showEndTime = false;
  @Input() showTargetHours = false;
  @Input() requireName = false;
  @Input() requireStartTime = false;
  @Input() requireEndTime = false;
  @Input() requireTargetHours = false;
  @Input() useScheduleForm = false;
  @Input() scheduleForm?: FormGroup;
  @Input() draggedShift: any = null;
  @Input() dropDate: any = null;
  @Input() programs: any[] = [];
  @Input() frequencyDropdownOptions: any[] = [];
  @Input() repeatEveryDropdownOptions: any[] = [];
  @Input() isEditingScheduleInModal = false;
  @Input() isCreatingSchedule = false;
  @Input() selectedSchedule: any = null;
  @Input() getProgramNameForShift?: (shift: any) => string;
  @Input() formatDateForDisplay?: (date: any) => string;
  @Input() getShiftTimeRange?: (shift: any) => string;
  @Input() getUpdatedByInfo?: (schedule: any) => string | null;
  @Input() getStaffName?: (staffId: number) => string;
  @Input() getMinRepeatUntilDate?: () => string;
  @Input() getFrequencySelectedId?: () => any;
  @Input() getRepeatEverySelectedId?: () => any;
  @Input() isWeekDaySelected?: (dayIndex: number) => boolean;
  @Input() toggleWeekDay?: (dayIndex: number) => void;
  @Input() getMonthDays?: () => number[];
  @Input() isMonthDaySelected?: (day: number) => boolean;
  @Input() toggleMonthDay?: (day: number) => void;
  @Input() hasScheduleFormChanges?: () => boolean;
  @Input() canCreateSchedules = true;
  @Input() canEditSchedules = true;

  get canModifyScheduleForm(): boolean {
    return this.isEditingScheduleInModal ? this.canEditSchedules : this.canCreateSchedules;
  }

  @Output() onClose = new EventEmitter<void>();
  @Output() onCreate = new EventEmitter<{
    name: string;
    startTime: string;
    endTime: string;
    targetHours: number;
  }>();
  @Output() onScheduleProgramChange = new EventEmitter<any>();
  @Output() onScheduleFrequencyChange = new EventEmitter<any>();
  @Output() onScheduleRepeatEveryChange = new EventEmitter<any>();
  @Output() onCreateSchedule = new EventEmitter<void>();
  @Output() onSaveAsDraft = new EventEmitter<void>();

  isClosing = false;
  showCustomRecurrenceModal = false;
  createForm: FormGroup;
  customRecurrenceForm: FormGroup;
  monthlyRepeatOptions: { value: string; label: string }[] = [];
  private wasVisible = false;
  private appliedCustomRecurrence: {
    repeatInterval: number;
    repeatFrequency: string;
    selectedWeekDays: number[];
    endOption: string;
    endDate: string;
    occurrences: number;
    monthlyRepeatOption?: string;
  } | null = null;

  getUpdatedByNameForSchedule(schedule: any): string {
    const updatedBy = schedule?.updatedBy;
    if (typeof updatedBy !== 'number') return '';
    if (typeof this.getStaffName !== 'function') return '';
    return (this.getStaffName(updatedBy) || '').toString().trim();
  }

  get annualFrequencyLabel(): string {
    const custom = this.appliedCustomRecurrence;
    if (custom?.repeatFrequency === 'year') {
      const formattedDate = this.getFormattedScheduleDate();
      if (!formattedDate) {
        return custom.repeatInterval === 1 ? 'Annually' : `Every ${custom.repeatInterval} years`;
      }

      return custom.repeatInterval === 1
        ? `Annually on ${formattedDate}`
        : `Every ${custom.repeatInterval} years on ${formattedDate}`;
    }

    const formattedDate = this.getFormattedScheduleDate();
    if (!formattedDate) {
      return 'Annually';
    }

    return `Annually on ${formattedDate}`;
  }

  get dailyFrequencyLabel(): string {
    const custom = this.appliedCustomRecurrence;
    if (custom?.repeatFrequency !== 'day') {
      return 'Daily';
    }

    const baseLabel = custom.repeatInterval === 1 ? 'Daily' : `Every ${custom.repeatInterval} days`;
    
    // Add recurrence summary in parentheses for custom recurrence
    if (custom) {
      const summaryParts: string[] = [];
      
      if (custom.endOption === 'never') {
        summaryParts.push('Ends never');
      } else if (custom.endOption === 'on' && custom.endDate) {
        summaryParts.push(`Ends on ${custom.endDate}`);
      } else if (custom.endOption === 'after' && custom.occurrences > 0) {
        summaryParts.push(`Ends after ${custom.occurrences} occurrence${custom.occurrences === 1 ? '' : 's'}`);
      }
      
      if (summaryParts.length > 0) {
        return `${baseLabel} (${summaryParts.join('. ')})`;
      }
    }

    return baseLabel;
  }

  get weeklyFrequencyLabel(): string {
    const custom = this.appliedCustomRecurrence;
    if (custom?.repeatFrequency !== 'week' || this.isWeekdaysSelection(custom)) {
      return this.getDefaultWeeklyFrequencyLabel();
    }

    const intervalLabel = custom.repeatInterval === 1 ? 'Every week' : `Every ${custom.repeatInterval} weeks`;
    const daysLabel = custom.selectedWeekDays.length > 0
      ? ` on ${this.getSelectedWeekDayLabels(custom.selectedWeekDays).join(', ')}`
      : '';

    return `${intervalLabel}${daysLabel}`;
  }

  get monthlyFrequencyLabel(): string {
    const custom = this.appliedCustomRecurrence;
    if (custom?.repeatFrequency !== 'month') {
      return this.getDefaultMonthlyFrequencyLabel();
    }

    const baseLabel = custom.repeatInterval === 1 ? 'Monthly' : `Every ${custom.repeatInterval} months`;
    
    // Add monthly repeat option if available
    if (custom.monthlyRepeatOption) {
      const selectedOption = this.monthlyRepeatOptions.find(opt => opt.value === custom.monthlyRepeatOption);
      if (selectedOption) {
        // Extract the part after "Monthly on " or "Monthly on the "
        const optionLabel = selectedOption.label.replace(/^Monthly on (the )?/, '');
        return `${baseLabel} on ${optionLabel}`;
      }
    }

    return baseLabel;
  }

  get hasCustomRecurrenceSummary(): boolean {
    return !!this.appliedCustomRecurrence;
  }

  get customRecurrenceSummary(): string {
    const scheduleDate = this.getScheduleDate();
    const custom = this.appliedCustomRecurrence;
    if (!custom) {
      return '';
    }

    const parts: string[] = [];
    const interval = custom.repeatInterval === 1 ? 'Every' : `Every ${custom.repeatInterval}`;

    if (custom.repeatFrequency === 'day') {
      parts.push(`${interval} day${custom.repeatInterval === 1 ? '' : 's'}`);
    } else if (custom.repeatFrequency === 'week') {
      const days = this.getSelectedWeekDayLabels(custom.selectedWeekDays);
      const daysLabel = days.length > 0 ? ` on ${days.join(', ')}` : '';
      parts.push(`${interval} week${custom.repeatInterval === 1 ? '' : 's'}${daysLabel}`);
    } else if (custom.repeatFrequency === 'month') {
      parts.push(`${interval} month${custom.repeatInterval === 1 ? '' : 's'}`);
    } else if (custom.repeatFrequency === 'year') {
      const formattedDate = scheduleDate
        ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(scheduleDate)
        : '';
      const onDateLabel = formattedDate ? ` on ${formattedDate}` : '';
      parts.push(`${interval} year${custom.repeatInterval === 1 ? '' : 's'}${onDateLabel}`);
    }

    if (custom.endOption === 'never') {
      parts.push('Ends never');
    } else if (custom.endOption === 'on' && custom.endDate) {
      parts.push(`Ends on ${custom.endDate}`);
    } else if (custom.endOption === 'after' && custom.occurrences > 0) {
      parts.push(`Ends after ${custom.occurrences} occurrence${custom.occurrences === 1 ? '' : 's'}`);
    }

    return parts.join('. ');
  }

  get showRepeatUntilInput(): boolean {
    const frequency = this.scheduleForm?.get('frequency')?.value;
    if (frequency === 'none') {
      return false;
    }

    // Show repeat until input when there's no custom recurrence or when custom recurrence ends on a specific date
    return !this.appliedCustomRecurrence || this.appliedCustomRecurrence.endOption === 'on';
  }

  get showCustomRepeatUntilDisplay(): boolean {
    return !!this.appliedCustomRecurrence && this.appliedCustomRecurrence.endOption !== 'on';
  }

  get customEndsSummary(): string {
    const custom = this.appliedCustomRecurrence;
    if (!custom || custom.endOption === 'on') {
      return '';
    }

    if (custom.endOption === 'never') {
      return 'Never';
    }

    return `After ${custom.occurrences} occurrence${custom.occurrences === 1 ? '' : 's'}`;
  }

  constructor(private fb: FormBuilder, private modalState: ModalStateService) {
    this.createForm = this.fb.group({
      name: [''],
      startTime: [''],
      endTime: [''],
      targetHours: [8]
    });
    this.customRecurrenceForm = this.fb.group({
      repeatInterval: [1, [Validators.required, Validators.min(1)]],
      repeatFrequency: ['week', Validators.required],
      selectedWeekDays: [[]],
      endOption: ['never', Validators.required],
      endDate: [''],
      occurrences: [10, [Validators.min(1)]],
      monthlyRepeatOption: ['day-1']
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
    if (changes['visible'] && this.visible) {
      this.createForm.reset({
        name: '',
        startTime: this.defaultStartTime,
        endTime: this.defaultEndTime,
        targetHours: this.defaultTargetHours
      });
    }
    if (changes['scheduleForm']) {
      this.syncRepeatUntilValidators();
    }
  }

  private handleVisibilityChange(visible: boolean): void {
    if (visible && !this.wasVisible) {
      this.modalState.open();
    }
    if (!visible && this.wasVisible) {
      this.modalState.close();
    }
    this.wasVisible = visible;
  }

  close(): void {
    if (this.isClosing) return;
    this.isClosing = true;
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
    if (this.createForm.invalid || this.isSaving) {
      this.createForm.markAllAsTouched();
      return;
    }
    const value = this.createForm.value;
    this.onCreate.emit({
      name: value.name,
      startTime: value.startTime,
      endTime: value.endTime,
      targetHours: Number(value.targetHours)
    });
  }

  onFrequencyChange(event: Event): void {
    const value = (event.target as HTMLSelectElement | null)?.value ?? 'none';
    if (value !== 'custom') {
      this.appliedCustomRecurrence = null;
      this.scheduleForm?.patchValue({
        customRepeatInterval: 1,
        customEndOption: null,
        customOccurrences: null,
        monthlyRepeatOption: null
      });
    }
    this.scheduleForm?.get('frequency')?.setValue(value);
    this.setRepeatEveryForFrequency(value);
    this.syncRepeatUntilValidators();

    if (value === 'custom') {
      this.generateMonthlyRepeatOptions();
      this.openCustomRecurrenceModal();
      return;
    }
  }

  closeCustomRecurrenceModal(): void {
    this.showCustomRecurrenceModal = false;
  }

  saveCustomRecurrence(): void {
    if (this.customRecurrenceForm.invalid) {
      this.customRecurrenceForm.markAllAsTouched();
      return;
    }

    const repeatFrequency = this.customRecurrenceForm.get('repeatFrequency')?.value;
    const repeatInterval = Number(this.customRecurrenceForm.get('repeatInterval')?.value) || 1;
    const endOption = this.customRecurrenceForm.get('endOption')?.value;
    const endDate = this.customRecurrenceForm.get('endDate')?.value;
    const occurrences = Number(this.customRecurrenceForm.get('occurrences')?.value) || 10;
    const selectedWeekDays = this.customRecurrenceForm.get('selectedWeekDays')?.value ?? [];
    const monthlyRepeatOption =
      this.customRecurrenceForm.get('monthlyRepeatOption')?.value ??
      this.getDefaultMonthlyRepeatOptionValue();

    this.appliedCustomRecurrence = {
      repeatInterval,
      repeatFrequency,
      selectedWeekDays: [...selectedWeekDays].sort((a: number, b: number) => a - b),
      endOption,
      endDate: endDate || '',
      occurrences,
      monthlyRepeatOption
    };

    const mappedFrequency = this.isWeekdaysSelection(this.appliedCustomRecurrence)
      ? 'weekdays'
      : this.mapCustomFrequencyToScheduleFrequency(repeatFrequency);

    this.scheduleForm?.patchValue({
      frequency: mappedFrequency,
      repeatEvery: repeatFrequency,
      customRepeatInterval: repeatInterval,
      customEndOption: endOption,
      customOccurrences: occurrences,
      selectedWeekDays: repeatFrequency === 'week' ? selectedWeekDays : this.scheduleForm?.get('selectedWeekDays')?.value ?? [],
      repeatUntil: endOption === 'on' ? endDate || '' : '',
      monthlyRepeatOption: monthlyRepeatOption
    });
    this.syncRepeatUntilValidators();

    this.showCustomRecurrenceModal = false;
  }

  toggleCustomWeekDay(dayIndex: number): void {
    const currentDays = [...(this.customRecurrenceForm.get('selectedWeekDays')?.value ?? [])];
    const index = currentDays.indexOf(dayIndex);
    if (index > -1) {
      currentDays.splice(index, 1);
    } else {
      currentDays.push(dayIndex);
    }
    this.customRecurrenceForm.patchValue({ selectedWeekDays: currentDays });
  }

  isCustomWeekDaySelected(dayIndex: number): boolean {
    const selectedDays = this.customRecurrenceForm.get('selectedWeekDays')?.value ?? [];
    return selectedDays.includes(dayIndex);
  }

  private setControlValidators(
    controlName: string,
    isVisible: boolean,
    validators: any[]
  ): void {
    const control = this.createForm.get(controlName);
    if (!control) return;
    if (!isVisible) {
      control.clearValidators();
      control.setValue(controlName === 'targetHours' ? this.defaultTargetHours : '');
      control.markAsPristine();
      control.markAsUntouched();
    } else {
      control.setValidators(validators);
    }
    control.updateValueAndValidity();
  }

  private openCustomRecurrenceModal(): void {
    this.showCustomRecurrenceModal = true;
    this.generateMonthlyRepeatOptions();
    this.syncCustomRecurrenceFormFromSchedule();
  }

  private generateMonthlyRepeatOptions(): void {
    const scheduleDate = this.getScheduleDate();
    if (!scheduleDate) {
      this.monthlyRepeatOptions = [{ value: 'day-1', label: 'Monthly on day 1' }];
      return;
    }

    const dayOfMonth = scheduleDate.getDate();
    const dayOfWeek = scheduleDate.getDay();
    const weekdayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(scheduleDate);
    const occurrence = this.getWeekdayOccurrenceInMonth(scheduleDate);

    this.monthlyRepeatOptions = [
      {
        value: `day-${dayOfMonth}`,
        label: `Monthly on day ${dayOfMonth}`
      },
      {
        value: `weekday-${occurrence}-${dayOfWeek}`,
        label: `Monthly on the ${this.getOrdinalLabel(occurrence)} ${weekdayName}`
      }
    ];
  }

  private syncCustomRecurrenceFormFromSchedule(): void {
    if (this.appliedCustomRecurrence) {
      this.customRecurrenceForm.patchValue({
        repeatInterval: this.appliedCustomRecurrence.repeatInterval,
        repeatFrequency: this.appliedCustomRecurrence.repeatFrequency,
        selectedWeekDays: [...this.appliedCustomRecurrence.selectedWeekDays],
        endOption: this.appliedCustomRecurrence.endOption,
        endDate: this.appliedCustomRecurrence.endDate,
        occurrences: this.appliedCustomRecurrence.occurrences,
        monthlyRepeatOption: this.appliedCustomRecurrence.monthlyRepeatOption || 'day-1'
      });
      return;
    }

    const frequency = this.scheduleForm?.get('frequency')?.value ?? 'weekly';
    const repeatUntil = this.scheduleForm?.get('repeatUntil')?.value ?? '';
    const selectedWeekDays = this.getDefaultSelectedWeekDays();

    this.customRecurrenceForm.patchValue({
      repeatInterval: 1,
      repeatFrequency: this.mapScheduleFrequencyToCustomFrequency(frequency),
      selectedWeekDays,
      endOption: repeatUntil ? 'on' : 'never',
      endDate: repeatUntil,
      occurrences: 10,
      monthlyRepeatOption: this.getDefaultMonthlyRepeatOptionValue()
    });
  }

  private setRepeatEveryForFrequency(frequency: string): void {
    const repeatEveryControl = this.scheduleForm?.get('repeatEvery');
    if (!repeatEveryControl) return;

    if (frequency === 'weekly') {
      repeatEveryControl.setValue('week');
    } else if (frequency === 'weekdays') {
      repeatEveryControl.setValue('week');
    } else if (frequency === 'monthly') {
      repeatEveryControl.setValue('month');
    } else if (frequency === 'annually') {
      repeatEveryControl.setValue('year');
    } else {
      repeatEveryControl.setValue('day');
    }
  }

  private mapCustomFrequencyToScheduleFrequency(frequency: string): string {
    if (frequency === 'week') return 'weekly';
    if (frequency === 'month') return 'monthly';
    if (frequency === 'year') return 'annually';
    return 'daily';
  }

  private mapScheduleFrequencyToCustomFrequency(frequency: string): string {
    if (frequency === 'weekly' || frequency === 'weekdays') return 'week';
    if (frequency === 'monthly') return 'month';
    if (frequency === 'annually') return 'year';
    return 'day';
  }

  private getScheduleDate(): Date | null {
    if (!this.dropDate) {
      return null;
    }

    const scheduleDate = this.dropDate instanceof Date
      ? new Date(this.dropDate)
      : new Date(this.dropDate);

    return Number.isNaN(scheduleDate.getTime()) ? null : scheduleDate;
  }

  private getFormattedScheduleDate(): string {
    const scheduleDate = this.getScheduleDate();
    if (!scheduleDate) {
      return '';
    }

    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long'
    }).format(scheduleDate);
  }

  private getSelectedWeekDayLabels(days: number[]): string[] {
    return [...days]
      .sort((a, b) => a - b)
      .map((dayIndex) => this.weekDays[dayIndex])
      .filter((label) => !!label);
  }

  private getDefaultWeeklyFrequencyLabel(): string {
    const selectedWeekDays = this.getDefaultSelectedWeekDays();
    const selectedLabels = this.getSelectedWeekDayLabels(selectedWeekDays);
    if (selectedLabels.length > 0) {
      return `Weekly on ${selectedLabels.join(', ')}`;
    }

    return 'Weekly';
  }

  private getDefaultMonthlyFrequencyLabel(): string {
    const scheduleDate = this.getScheduleDate();
    if (!scheduleDate) {
      return 'Monthly';
    }

    const weekdayName = new Intl.DateTimeFormat('en-US', {
      weekday: 'long'
    }).format(scheduleDate);
    const occurrence = this.getWeekdayOccurrenceInMonth(scheduleDate);

    return `Monthly on ${this.getOrdinalLabel(occurrence)} ${weekdayName}`;
  }

  private getDefaultSelectedWeekDays(): number[] {
    const formSelectedWeekDays = this.scheduleForm?.get('selectedWeekDays')?.value;
    if (Array.isArray(formSelectedWeekDays) && formSelectedWeekDays.length > 0) {
      return [...formSelectedWeekDays];
    }

    const scheduleDate = this.getScheduleDate();
    if (scheduleDate) {
      return [scheduleDate.getDay()];
    }

    return [];
  }

  private getDefaultMonthlyRepeatOptionValue(): string {
    const scheduleDate = this.getScheduleDate();
    if (!scheduleDate) {
      return 'day-1';
    }

    return `day-${scheduleDate.getDate()}`;
  }

  private isWeekdaysSelection(custom: {
    repeatInterval: number;
    repeatFrequency: string;
    selectedWeekDays: number[];
  } | null): boolean {
    if (!custom || custom.repeatFrequency !== 'week' || custom.repeatInterval !== 1) {
      return false;
    }

    const sortedDays = [...custom.selectedWeekDays].sort((a, b) => a - b);
    return this.weekdayIndices.every((day, index) => sortedDays[index] === day);
  }

  private syncRepeatUntilValidators(): void {
    const repeatUntilControl = this.scheduleForm?.get('repeatUntil');
    if (!repeatUntilControl) {
      return;
    }

    if (this.appliedCustomRecurrence && this.appliedCustomRecurrence.endOption !== 'on') {
      repeatUntilControl.clearValidators();
      repeatUntilControl.setValue('');
    } else if (this.scheduleForm?.get('frequency')?.value !== 'none') {
      repeatUntilControl.setValidators([Validators.required]);
    } else {
      repeatUntilControl.clearValidators();
    }

    repeatUntilControl.updateValueAndValidity();
  }

  private getWeekdayOccurrenceInMonth(date: Date): number {
    let occurrence = 0;
    for (let day = 1; day <= date.getDate(); day++) {
      const testDate = new Date(date.getFullYear(), date.getMonth(), day);
      if (testDate.getDay() === date.getDay()) {
        occurrence++;
      }
    }

    return occurrence;
  }

  private getOrdinalLabel(value: number): string {
    if (value === 1) return 'first';
    if (value === 2) return 'second';
    if (value === 3) return 'third';
    if (value === 4) return 'fourth';
    return `${value}th`;
  }
}
