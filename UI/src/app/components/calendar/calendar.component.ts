import { Component, OnInit, OnDestroy, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Observable, Subject, BehaviorSubject, of, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ScheduleService } from '../../services/schedule.service';
import { SignalRService } from '../../services/signalr.service';
import { ProgramRoleStaffService, Program, Role, Staff, FlattenedProgram } from '../../services/program-role-staff.service';
import { ToastService } from '../../services/toast.service';
import {
  Shift,
  Schedule,
  Instance,
  CalendarEvent,
  UpdateAssigneesRequest,
  AssignmentRule,
  Assignee,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  CreateAssignmentRuleRequest,
  AssignmentRuleType,
  EditScope
} from '../../models/schedule.models';
import {
  getUserTimezone,
  formatDateAsLocalString as schedFormatDate,
  parseDateOnlyAsLocalDate,
  calculateShiftDurationMinutes,
  convertFrequencyToRRule,
  resolveScheduleEndDate,
  getNewScheduleOccurrenceDates,
  findScheduleConflict,
  setRepeatEveryForFrequency,
  type ScheduleFormSnapshot
} from '../../utils/schedule-scheduling.utils';
import { forkJoin } from 'rxjs';
import * as ScheduleActions from '../../store/schedule.actions';
import { selectShifts, selectSchedules } from '../../store/schedule.selectors';
import { SharedCalendarComponent } from '../../shared/components/calendar/shared-calendar.component';
import { mergeDemoShifts } from '../../demo/demo-shifts';
import { environment } from '../../../environments/environment';
import { IcmCreatePopupComponent } from '../../core/components/icm-create-popup/icm-create-popup.component';
import { IcmUpdatePopupComponent } from '../../core/components/icm-update-popup/icm-update-popup.component';

/**
 * Calendar component.
 * Displays published schedules in read-only calendar mode.
 * Shows only published schedules, no editing capabilities.
 * Can work with or without NgRx store.
 */
@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    SharedCalendarComponent,
    IcmCreatePopupComponent,
    IcmUpdatePopupComponent
  ],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit, OnDestroy {
  programs: Program[] = [];
  
  // Calendar properties
  currentDate = new Date();
  calendarDays: Date[] = [];
  calendarEvents: CalendarEvent[] = [];
  weeklyDays: Date[] = [];
  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  calendarViewType: 'monthly' | 'weekly' | 'daily' = 'weekly';
  timeSlots: number[] = Array.from({ length: 24 }, (_, i) => i); // 0-23 hours
  isLoadingOccurrences = false;
  
  // Shift and instance data
  shifts: Shift[] = [];
  instances: Instance[] = [];
  schedules: Schedule[] = [];
  
  // Filter properties
  selectedProgramId: number | null = null;
  selectedRoleId: number | null = null;
  selectedStaffId: number | null = null;
  filterNoStaff = false;
  filterUnderStaffed = false;
  filtersApplied = false;
  roles: Role[] = [];
  filteredRoles: Role[] = [];
  staff: Staff[] = [];
  filteredStaff: Staff[] = [];
  
  // Event popup properties
  showEventPopup = false;
  clickedEvent: CalendarEvent | null = null;
  popupPosition = { x: 0, y: 0 };
  
  // Selected items for popup
  selectedInstance: Instance | null = null;
  selectedShift: Shift | null = null;
  selectedSchedule: Schedule | null = null;
  
  // Caching
  scheduleCacheById: Map<number, Schedule> = new Map();
  schedulesLoadingByShiftId: Set<number> = new Set();
  staffNameCache: Map<number, string> = new Map();
  assignmentRulesByShiftId: Map<number, AssignmentRule[]> = new Map();
  
  // Assign staff (icm-update-popup)
  showStaffAssignmentModal = false;
  /** When set, drives save path for the staff popup. */
  staffModalMode: 'instance' | 'rule' | null = null;
  staffSearchQuery = '';
  showStaffDropdown = false;
  filteredStaffList: Array<{ id: number; name: string; role: string }> = [];
  staffAssignments: any[] = [];
  currentStaffAssignment: Record<string, any> | null = null;
  editingStaffAssignmentIndex: number | null = null;
  newStaffAssignment = false;
  staffModalFrequencyRRule: string | null = null;
  timeOffRequests: any[] = [];
  availableStaff: Staff[] = [];
  assignStaffForm: FormGroup;
  assignStaffModalStaffId: number | null = null;
  isAssigningStaff = false;

  /** Drag-and-drop + create/edit schedule (StaffScheduler parity). */
  shiftDropEnabled = true;
  dragOverDay: Date | null = null;
  pendingDragShift: Shift | null = null;
  draggedShift: Shift | null = null;
  dropDate: Date | null = null;
  showScheduleModal = false;
  isEditingScheduleInModal = false;
  isSavingSchedule = false;
  editStartDate: Date | null = null;
  scheduleForm: FormGroup;

  readonly frequencyOptions = [
    { id: 1, label: 'Does not repeat', value: 'none' },
    { id: 2, label: 'Daily', value: 'daily' },
    { id: 3, label: 'Weekly', value: 'weekly' },
    { id: 4, label: 'Monthly', value: 'monthly' }
  ];
  readonly repeatEveryOptions = [
    { id: 1, label: 'Day', value: 'day' },
    { id: 2, label: 'Week', value: 'week' },
    { id: 3, label: 'Month', value: 'month' }
  ];

  // Cleanup
  private destroy$ = new Subject<void>();

  constructor(
    private programRoleStaffService: ProgramRoleStaffService,
    @Optional() private router: Router,
    private fb: FormBuilder,
    @Optional() private store: Store,
    private scheduleService: ScheduleService,
    private signalRService: SignalRService,
    private toastService: ToastService
  ) {
    this.assignStaffForm = this.fb.group({
      staffId: [null, Validators.required]
    });

    this.ruleStaffForm = this.fb.group({
      staffId: [null, Validators.required],
      startTime: ['09:00', Validators.required],
      endTime: ['17:00', Validators.required]
    });

    this.scheduleForm = this.fb.group({
      programId: [null as number | null, Validators.required],
      targetHours: [8, [Validators.required, Validators.min(0.5)]],
      frequency: ['none', Validators.required],
      repeatUntil: ['', Validators.required],
      repeatEvery: ['day'],
      customRepeatInterval: [1],
      customEndOption: [null as string | null],
      customOccurrences: [null as number | null],
      monthlyRepeatOption: [null as string | null],
      selectedWeekDays: [[] as number[]],
      selectedMonthDays: [[] as number[]]
    });

    this.scheduleForm.get('frequency')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((frequency) => {
      const repeatUntilControl = this.scheduleForm.get('repeatUntil');
      const repeatEveryControl = this.scheduleForm.get('repeatEvery');
      if (frequency === 'none') {
        repeatUntilControl?.clearValidators();
        repeatEveryControl?.clearValidators();
        this.scheduleForm.patchValue({ selectedWeekDays: [], selectedMonthDays: [] });
      } else {
        repeatUntilControl?.setValidators(Validators.required);
        repeatEveryControl?.setValidators(Validators.required);
      }
      const nextRepeat = setRepeatEveryForFrequency(frequency);
      repeatEveryControl?.setValue(nextRepeat, { emitEvent: false });
      repeatUntilControl?.updateValueAndValidity();
      repeatEveryControl?.updateValueAndValidity();
    });
  }

  ngOnInit(): void {
    // Load programs
    this.programRoleStaffService.getPrograms().subscribe({
      next: (programs) => {
        this.programs = programs;
      },
      error: (error) => {
        console.error('Error loading programs:', error);
        this.toastService.showError('Failed to load programs');
      }
    });

    // Load all roles (for dropdown - API doesn't support filtering by program)
    this.programRoleStaffService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
        this.filteredRoles = roles;
      },
      error: (error) => {
        console.error('Error loading roles:', error);
        this.toastService.showError('Failed to load roles');
      }
    });

    // Load all staff initially
    this.programRoleStaffService.getAllStaff().subscribe({
      next: (staff) => {
        this.staff = staff;
        this.filteredStaff = staff;
      },
      error: (error) => {
        console.error('Error loading staff:', error);
        this.toastService.showError('Failed to load staff');
      }
    });
    
    // Load all shifts - try store first, fallback to service
    if (this.store && ScheduleActions && selectShifts) {
      try {
        this.store.dispatch(ScheduleActions.loadShifts({}));
        this.store.select(selectShifts)
          .pipe(takeUntil(this.destroy$))
          .subscribe((shifts: Shift[]) => {
            this.shifts = mergeDemoShifts(shifts, environment.includeDemoShifts);
            console.log('Calendar - Shifts loaded from store:', this.shifts.length);
          });
      } catch (error) {
        console.warn('Store not available, loading shifts directly from service:', error);
        this.loadShiftsFromService();
      }
    } else {
      // No store available, load directly from service
      this.loadShiftsFromService();
    }
    
    // Initialize calendar
    this.generateCalendarDays();
    this.generateWeeklyDays();
    this.loadCalendarOccurrences();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Loads shifts directly from the service (fallback when store is not available).
   */
  private loadShiftsFromService(): void {
    this.scheduleService.getAllShifts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (shifts) => {
          this.shifts = mergeDemoShifts(shifts, environment.includeDemoShifts);
          console.log('Calendar - Shifts loaded from service:', this.shifts.length);
        },
        error: (error) => {
          console.error('Error loading shifts:', error);
          this.toastService.showError('Failed to load shifts');
          this.shifts = mergeDemoShifts([], environment.includeDemoShifts);
        }
      });
  }

  /**
   * Gets the flattened list of programs for dropdown display.
   * Converts hierarchical structure to flat list with level information for indentation.
   */
  getFlattenedPrograms(): FlattenedProgram[] {
    return this.programRoleStaffService.flattenPrograms(this.programs);
  }

  programIndent(level: number): string {
    return '  '.repeat(Math.max(0, level || 0));
  }

  /**
   * Gets the location name (program name) for a given location ID.
   * @param locationId Location ID (program ID).
   * @returns Location name or null.
   */
  getLocationName(locationId: number | null | undefined): string | null {
    if (!locationId) return null;
    const program = this.programs.find(p => p.id === locationId);
    return program ? program.name : null;
  }

  /**
   * Loads roles based on selected program.
   */
  loadRoles(): void {
    if (!this.selectedProgramId) {
      this.roles = [];
      this.filteredRoles = [];
      return;
    }

    this.programRoleStaffService.getRolesByProgram(this.selectedProgramId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (roles: any[]) => {
          this.roles = roles;
          this.filteredRoles = roles;
        },
        error: (error: any) => {
          console.error('Error loading roles:', error);
          this.toastService.showError('Failed to load roles');
        }
      });
  }

  /**
   * Loads staff based on selected program and role.
   */
  loadStaff(): void {
    if (!this.selectedProgramId) {
      this.staff = [];
      this.filteredStaff = [];
      return;
    }

    this.programRoleStaffService.getStaff(this.selectedProgramId, this.selectedRoleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (staff) => {
          this.staff = staff;
          this.filteredStaff = staff;
        },
        error: (error) => {
          console.error('Error loading staff:', error);
          this.toastService.showError('Failed to load staff');
        }
      });
  }

  /**
   * Handles program filter change.
   */
  onProgramFilterChange(programId: number | null): void {
    this.selectedProgramId = programId;
    this.selectedRoleId = null;
    this.selectedStaffId = null;
    this.filtersApplied = false;
    
    if (programId) {
      this.loadRoles();
      this.loadStaff();
    } else {
      this.roles = [];
      this.filteredRoles = [];
      this.staff = [];
      this.filteredStaff = [];
    }
  }

  /**
   * Handles role filter change.
   */
  onRoleFilterChange(roleId: number | null): void {
    this.selectedRoleId = roleId;
    this.selectedStaffId = null;
    this.filtersApplied = false;
    this.loadStaff();
  }

  /**
   * Handles staff filter change.
   */
  onStaffFilterChange(staffId: number | null): void {
    this.selectedStaffId = staffId;
    this.filtersApplied = false;
  }

  /**
   * Applies all filters and reloads calendar.
   */
  applyFilters(): void {
    this.filtersApplied = true;
    this.loadCalendarOccurrences();
  }

  /**
   * Clears all filters.
   */
  clearFilters(): void {
    this.selectedProgramId = null;
    this.selectedRoleId = null;
    this.selectedStaffId = null;
    this.filterNoStaff = false;
    this.filterUnderStaffed = false;
    this.filtersApplied = false;
    
    this.roles = [];
    this.filteredRoles = [];
    this.staff = [];
    this.filteredStaff = [];
    
    this.loadCalendarOccurrences();
  }

  /**
   * Loads calendar occurrences for the current view.
   */
  loadCalendarOccurrences(): void {
    this.isLoadingOccurrences = true;
    
    // Calculate date range based on view type
    const { startDate, endDate } = this.getDateRangeForView();
    const startStr = this.formatDateAsLocalString(new Date(startDate));
    const endStr = this.formatDateAsLocalString(new Date(endDate));
    
    // Load both schedules and instances
    forkJoin({
      schedules: this.scheduleService.getSchedules(startStr, endStr, undefined, undefined),
      instances: this.scheduleService.getInstances(startDate, endDate, undefined, undefined, false)
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ schedules, instances }) => {
          console.log('Readonly calendar - Schedules loaded:', schedules.length);
          console.log('Readonly calendar - Instances loaded:', instances.length);
          this.schedules = schedules;
          this.instances = instances;
          
          // Extract unique shiftIds from loaded schedules and instances
          const scheduleShiftIds = [...new Set(schedules.map(s => s.shiftId))];
          const instanceShiftIds = [...new Set(instances.map(i => i.shiftId).filter(id => id !== null && id !== undefined))];
          const allShiftIds = [...new Set([...scheduleShiftIds, ...instanceShiftIds])];
          
          console.log('Readonly calendar - Loading assignment rules for shiftIds:', allShiftIds);
          
          // Load assignment rules for all shifts in parallel
          if (allShiftIds.length > 0) {
            this.loadAssignmentRulesForShifts(allShiftIds).then(() => {
              // After rules are loaded, convert to calendar events
              this.convertToCalendarEvents();
              this.isLoadingOccurrences = false;
            });
          } else {
            // No shifts, just convert to calendar events
            this.convertToCalendarEvents();
            this.isLoadingOccurrences = false;
          }
        },
        error: (error) => {
          console.error('Error loading calendar occurrences:', error);
          this.toastService.showError('Failed to load calendar data');
          this.isLoadingOccurrences = false;
        }
      });
  }

  /**
   * Gets date range for current calendar view.
   */
  getDateRangeForView(): { startDate: string; endDate: string } {
    let startDate: Date;
    let endDate: Date;

    if (this.calendarViewType === 'monthly') {
      // Start from first day of current month
      startDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
      // End on last day of current month
      endDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (this.calendarViewType === 'weekly') {
      // Start from Sunday of current week
      const dayOfWeek = this.currentDate.getDay();
      startDate = new Date(this.currentDate);
      startDate.setDate(this.currentDate.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
      
      // End on Saturday of current week
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else { // daily
      // Start and end on current day
      startDate = new Date(this.currentDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(this.currentDate);
      endDate.setHours(23, 59, 59, 999);
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }

  /**
   * Converts schedules and instances to calendar events.
   */
  convertToCalendarEvents(): void {
    this.calendarEvents = [];
    
    console.log('Converting to calendar events - schedules:', this.schedules.length, 'instances:', this.instances.length);
    
    // Convert all schedules to calendar events
    if (this.schedules.length > 0) {
      this.convertSchedulesToCalendarEvents();
      console.log('Calendar events after schedules:', this.calendarEvents.length);
    }
    
    console.log('Total calendar events:', this.calendarEvents.length);

    // Apply filters if they are set
    if (this.filtersApplied) {
      this.applyEventFilters();
    }
  }
  
  /**
   * Converts schedules to calendar events.
   * Expands RRule to show all occurrences within the date range.
   */
  private convertSchedulesToCalendarEvents(): void {
    const { startDate, endDate } = this.getDateRangeForView();
    const fromDate = new Date(startDate);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(endDate);
    toDate.setHours(23, 59, 59, 999);

    const parseTimeToHoursMinutes = (timeStr: string | null | undefined): { hours: number; minutes: number } | null => {
      if (!timeStr) return null;
      const parts = timeStr.split(':');
      if (parts.length < 2) return null;
      const hours = Number(parts[0]);
      const minutes = Number(parts[1]);
      if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
      return { hours, minutes };
    };
    
    for (const schedule of this.schedules) {
      const shift = this.shifts.find(s => s.id === schedule.shiftId);
      if (!shift) {
        console.warn('Shift not found for schedule:', schedule.shiftId);
        continue;
      }
      
      // Parse the start date/time from the schedule.
      // Some published schedules store dtStartLocal as a date-only string, which parses to 00:00.
      // In that case, derive the time from the shift's start/end times.
      const startDateTime = new Date(schedule.dtStartLocal);
      const scheduleHasExplicitTime = typeof schedule.dtStartLocal === 'string'
        ? schedule.dtStartLocal.includes('T')
        : false;
      const shiftStart = parseTimeToHoursMinutes(shift.startTime);
      const shiftEnd = parseTimeToHoursMinutes(shift.endTime);

      const durationMs = schedule.durationMinutes * 60 * 1000;
      
      // Parse until date if specified (format: YYYY-MM-DD)
      let untilDate: Date | null = null;
      if (schedule.until) {
        untilDate = new Date(schedule.until);
        untilDate.setHours(23, 59, 59, 999);
      }
      
      // Parse excluded dates (format: YYYY-MM-DD[])
      const exDates = schedule.exDate || [];
      
      // Expand RRule to get all occurrences
      const occurrences = this.expandRRuleOccurrences(
        schedule.rRule,
        startDateTime,
        untilDate,
        fromDate,
        toDate,
        exDates
      );
      
      // Create calendar events for each occurrence
      for (const occurrenceDate of occurrences) {
        const occurrenceStart = new Date(occurrenceDate);
        const shouldUseShiftTime = (!scheduleHasExplicitTime) || (startDateTime.getHours() === 0 && startDateTime.getMinutes() === 0);

        if (shouldUseShiftTime && shiftStart) {
          occurrenceStart.setHours(shiftStart.hours, shiftStart.minutes, 0, 0);
        } else {
          occurrenceStart.setHours(startDateTime.getHours(), startDateTime.getMinutes(), startDateTime.getSeconds(), startDateTime.getMilliseconds());
        }

        let occurrenceEnd: Date;
        if (shouldUseShiftTime && shiftEnd) {
          occurrenceEnd = new Date(occurrenceStart);
          occurrenceEnd.setHours(shiftEnd.hours, shiftEnd.minutes, 0, 0);
          if (occurrenceEnd <= occurrenceStart) {
            occurrenceEnd.setDate(occurrenceEnd.getDate() + 1);
          }
        } else {
          occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
        }
        
        // If staff filter is active, create separate events for each assignment time block
        if (this.selectedStaffId !== null) {
          const occurrenceDateStr = this.formatDateAsLocalString(occurrenceStart);
          const rulesForShift = this.assignmentRulesByShiftId.get(schedule.shiftId) || [];
          const staffRules = rulesForShift
            .filter(r => (r.status || 'published').toLowerCase() === 'published')
            .filter(r => r.staffId === this.selectedStaffId)
            .filter(r => typeof schedule.id !== 'number' || r.scheduleId === schedule.id || r.scheduleId == null)
            .filter(r => {
              const effectiveFrom = r.effectiveFrom;
              if (!effectiveFrom || occurrenceDateStr < effectiveFrom) return false;
              if (r.effectiveTo && occurrenceDateStr > r.effectiveTo) return false;
              return true;
            });

          // Create a separate event for each assignment rule time block
          for (const rule of staffRules) {
            if (!rule.startTime || !rule.endTime) continue;

            // Parse assignment rule times and create date objects for this occurrence date
            const [startHours, startMinutes] = rule.startTime.split(':').map(Number);
            const [endHours, endMinutes] = rule.endTime.split(':').map(Number);
            
            const assignmentStart = new Date(occurrenceStart);
            assignmentStart.setHours(startHours, startMinutes, 0, 0);
            
            const assignmentEnd = new Date(occurrenceStart);
            assignmentEnd.setHours(endHours, endMinutes, 0, 0);

            const event: CalendarEvent = {
              id: `schedule-${schedule.id}-${occurrenceStart.getTime()}-rule-${rule.id}`,
              title: shift.name,
              start: assignmentStart,
              end: assignmentEnd,
              allDay: false,
              color: '',
              resource: ({
                shiftId: schedule.shiftId,
                scheduleId: schedule.id,
                assignmentRuleId: rule.id
              } as any)
            };
            
            event.color = this.getEventColor(event);
            this.calendarEvents.push(event);
          }
        } else {
          // No staff filter - show full schedule block as before
          const event: CalendarEvent = {
            id: `schedule-${schedule.id}-${occurrenceStart.getTime()}`,
            title: shift.name,
            start: occurrenceStart,
            end: occurrenceEnd,
            allDay: false,
            color: '',
            resource: {
              shiftId: schedule.shiftId,
              scheduleId: schedule.id
            }
          };
          
          event.color = this.getEventColor(event);
          this.calendarEvents.push(event);
        }
      }
    }
  }
  
  /**
   * Expands an RRule to generate all occurrence dates within a date range.
   * Handles common patterns: DAILY, WEEKLY, MONTHLY, YEARLY.
   */
  private expandRRuleOccurrences(
    rRule: string,
    dtStart: Date,
    until: Date | null,
    from: Date,
    to: Date,
    exDates: string[]
  ): Date[] {
    const occurrences: Date[] = [];
    
    // Parse RRule
    const rRuleUpper = rRule.toUpperCase();
    const freqMatch = rRuleUpper.match(/FREQ=([A-Z]+)/);
    if (!freqMatch) {
      // If no valid FREQ, just return the start date if it's in range
      if (dtStart >= from && dtStart <= to) {
        occurrences.push(new Date(dtStart));
      }
      return occurrences;
    }
    
    const freq = freqMatch[1];
    const byDayMatch = rRuleUpper.match(/BYDAY=([A-Z0-9,]+)/);
    const byDayList = byDayMatch ? byDayMatch[1].split(',').map(d => d.trim()) : [];
    
    // Map day names to day of week numbers
    const dayNameToDayOfWeek: { [key: string]: number } = {
      'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6,
      'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3, 'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6
    };
    
    // Parse UNTIL date if specified
    const endDate = until && until < to ? until : to;
    
    // Parse excluded dates
    const excludedDates = exDates.map(d => {
      const date = new Date(d);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    });
    
    // Check if a date is excluded
    const isExcluded = (date: Date): boolean => {
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);
      return excludedDates.includes(dateOnly.getTime());
    };
    
    // Generate occurrences based on frequency
    let currentDate = new Date(dtStart);
    
    // Limit iterations to prevent infinite loops
    let iterations = 0;
    const maxIterations = 10000;
    
    // For WEEKLY with BYDAY, we need to check each day in the range
    if (freq === 'WEEKLY' && byDayList.length > 0) {
      // Get all days of week that match BYDAY
      const targetDays = byDayList.map(day => {
        const dayName = day.replace(/^\d+/, '');
        return dayNameToDayOfWeek[dayName] !== undefined ? dayNameToDayOfWeek[dayName] : -1;
      }).filter(d => d >= 0);
      
      let checkDate = new Date(from);
      checkDate.setHours(dtStart.getHours(), dtStart.getMinutes(), dtStart.getSeconds(), dtStart.getMilliseconds());
      
      if (checkDate < dtStart) {
        checkDate = new Date(dtStart);
      }
      
      while (checkDate <= endDate && iterations < maxIterations) {
        iterations++;
        
        const dayOfWeek = checkDate.getDay();
        if (targetDays.includes(dayOfWeek) && !isExcluded(checkDate)) {
          occurrences.push(new Date(checkDate));
        }
        
        checkDate.setDate(checkDate.getDate() + 1);
      }
    } else {
      // For DAILY, MONTHLY, YEARLY, or WEEKLY without BYDAY
      while (currentDate <= endDate && iterations < maxIterations) {
        iterations++;
        
        if (currentDate >= from && currentDate <= endDate && !isExcluded(currentDate)) {
          if (freq === 'DAILY') {
            occurrences.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (freq === 'WEEKLY') {
            occurrences.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 7);
          } else if (freq === 'MONTHLY') {
            occurrences.push(new Date(currentDate));
            currentDate.setMonth(currentDate.getMonth() + 1);
          } else if (freq === 'YEARLY') {
            occurrences.push(new Date(currentDate));
            currentDate.setFullYear(currentDate.getFullYear() + 1);
          } else {
            if (occurrences.length === 0 && currentDate >= from) {
              occurrences.push(new Date(currentDate));
            }
            break;
          }
        } else {
          if (currentDate < from) {
            if (freq === 'DAILY') {
              currentDate = new Date(from);
              currentDate.setHours(dtStart.getHours(), dtStart.getMinutes(), dtStart.getSeconds(), dtStart.getMilliseconds());
            } else if (freq === 'WEEKLY') {
              const daysDiff = Math.floor((from.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
              const weeksToSkip = Math.floor(daysDiff / 7);
              currentDate.setDate(currentDate.getDate() + (weeksToSkip * 7));
            } else if (freq === 'MONTHLY') {
              currentDate = new Date(from);
              currentDate.setHours(dtStart.getHours(), dtStart.getMinutes(), dtStart.getSeconds(), dtStart.getMilliseconds());
            } else {
              currentDate.setDate(currentDate.getDate() + 1);
            }
          } else {
            break;
          }
        }
      }
    }
    
    return occurrences;
  }

  /**
   * Applies filters to calendar events.
   */
  applyEventFilters(): void {
    this.calendarEvents = this.calendarEvents.filter(event => {
      // Program filter
      if (this.selectedProgramId) {
        const shift = this.shifts.find(s => s.id === event.resource?.shiftId);
        if (shift?.locationId !== this.selectedProgramId) {
          return false;
        }
      }

      const scheduleId = event.resource?.scheduleId;
      const eventDate = new Date(event.start);
      eventDate.setHours(0, 0, 0, 0);

      // Role filter
      if (this.selectedRoleId) {
        const instanceId = event.resource?.instanceId;
        const inst = typeof instanceId === 'number'
          ? this.instances.find(i => i.id === instanceId)
          : undefined;

        const hasAssigneeRoleMatch = (inst?.assignees || []).some(a => {
          const staffId = a.staffId;
          if (typeof staffId !== 'number') return false;
          const staffMember = this.staff.find(s => s.id === staffId);
          return !!staffMember && staffMember.roleId === this.selectedRoleId;
        });

        const shiftId = event.resource?.shiftId;
        const scheduleId = event.resource?.scheduleId;
        const rules = typeof shiftId === 'number'
          ? (this.assignmentRulesByShiftId.get(shiftId) || [])
              .filter(r => (r.status || 'published').toLowerCase() === 'published')
              .filter(r => typeof scheduleId !== 'number' || r.scheduleId === scheduleId)
          : [];

        const activeRules = rules.filter(r => {
          const effectiveFrom = new Date(r.effectiveFrom);
          effectiveFrom.setHours(0, 0, 0, 0);

          const effectiveTo = r.effectiveTo ? new Date(r.effectiveTo) : null;
          if (effectiveTo) effectiveTo.setHours(0, 0, 0, 0);

          return eventDate >= effectiveFrom && (!effectiveTo || eventDate <= effectiveTo);
        });

        const hasRuleRoleMatch = activeRules.some(rule => {
          if (rule.roleId === this.selectedRoleId) {
            return true;
          }

          if (rule.type === 'Direct' && rule.staffId) {
            const staffMember = this.staff.find(s => s.id === rule.staffId);
            return !!staffMember && staffMember.roleId === this.selectedRoleId;
          }

          return false;
        });

        if (!hasAssigneeRoleMatch && !hasRuleRoleMatch) {
          return false;
        }
      }

      // Staff filter
      if (this.selectedStaffId) {
        const instanceId = event.resource?.instanceId;
        const inst = typeof instanceId === 'number'
          ? this.instances.find(i => i.id === instanceId)
          : undefined;

        const hasAssigneeMatch = (inst?.assignees || []).some(a => a.staffId === this.selectedStaffId);

        const shiftId = event.resource?.shiftId;
        const scheduleId = event.resource?.scheduleId;
        const rules = typeof shiftId === 'number'
          ? (this.assignmentRulesByShiftId.get(shiftId) || [])
              .filter(r => (r.status || 'published').toLowerCase() === 'published')
              .filter(r => typeof scheduleId !== 'number' || r.scheduleId === scheduleId)
          : [];

        const eventDate = new Date(event.start);
        eventDate.setHours(0, 0, 0, 0);

        const activeRules = rules.filter(r => {
          const effectiveFrom = new Date(r.effectiveFrom);
          effectiveFrom.setHours(0, 0, 0, 0);

          const effectiveTo = r.effectiveTo ? new Date(r.effectiveTo) : null;
          if (effectiveTo) effectiveTo.setHours(0, 0, 0, 0);

          return eventDate >= effectiveFrom && (!effectiveTo || eventDate <= effectiveTo);
        });

        const hasRuleMatch = activeRules.some(rule => rule.staffId === this.selectedStaffId);

        if (!hasAssigneeMatch && !hasRuleMatch) {
          return false;
        }
      }

      // No Schedule (no staff assigned)
      if (this.filterNoStaff) {
        if (this.getStaffCount(event) > 0) {
          return false;
        }
      }

      // Under Schedule (some staff but hours incomplete)
      if (this.filterUnderStaffed) {
        const staffCount = this.getStaffCount(event);
        const assignedHours = this.getAssignedHours(event);
        const targetHours = this.getTargetHours(event);
        if (staffCount === 0 || assignedHours >= targetHours) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Generates calendar days for monthly view.
   */
  generateCalendarDays(): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    this.calendarDays = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      this.calendarDays.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
  }

  /**
   * Generates weekly days for weekly view.
   */
  generateWeeklyDays(): void {
    const startOfWeek = new Date(this.currentDate);
    const dayOfWeek = this.currentDate.getDay();
    startOfWeek.setDate(this.currentDate.getDate() - dayOfWeek);
    
    this.weeklyDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      this.weeklyDays.push(day);
    }
  }

  /**
   * Sets calendar view type.
   */
  setCalendarViewType(type: 'monthly' | 'weekly' | 'daily'): void {
    this.calendarViewType = type;
    this.generateCalendarDays();
    this.generateWeeklyDays();
    this.loadCalendarOccurrences();
  }

  /**
   * Navigates to previous period.
   */
  previousPeriod(): void {
    if (this.calendarViewType === 'monthly') {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    } else if (this.calendarViewType === 'weekly') {
      this.currentDate.setDate(this.currentDate.getDate() - 7);
    } else { // daily
      this.currentDate.setDate(this.currentDate.getDate() - 1);
    }
    this.generateCalendarDays();
    this.generateWeeklyDays();
    this.loadCalendarOccurrences();
  }

  /**
   * Navigates to next period.
   */
  nextPeriod(): void {
    if (this.calendarViewType === 'monthly') {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    } else if (this.calendarViewType === 'weekly') {
      this.currentDate.setDate(this.currentDate.getDate() + 7);
    } else { // daily
      this.currentDate.setDate(this.currentDate.getDate() + 1);
    }
    this.generateCalendarDays();
    this.generateWeeklyDays();
    this.loadCalendarOccurrences();
  }

  /**
   * Navigates to today's date.
   */
  goToToday(): void {
    this.currentDate = new Date();
    this.generateCalendarDays();
    this.generateWeeklyDays();
    this.loadCalendarOccurrences();
  }

  /**
   * Gets calendar title based on current view.
   */
  getCalendarTitle(): string {
    if (this.calendarViewType === 'monthly') {
      return this.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (this.calendarViewType === 'weekly') {
      const startOfWeek = this.weeklyDays[0];
      const endOfWeek = this.weeklyDays[6];
      return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else { // daily
      return this.currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  }

  /**
   * Gets events for a specific day.
   */
  getEventsForDay(day: Date): CalendarEvent[] {
    return this.calendarEvents.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.getDate() === day.getDate() &&
             eventDate.getMonth() === day.getMonth() &&
             eventDate.getFullYear() === day.getFullYear();
    });
  }

  /**
   * Checks if a date is today.
   */
  isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  isPastDate(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate < today;
  }

  /**
   * Checks if a date is in current month.
   */
  isCurrentMonth(day: Date): boolean {
    return day.getMonth() === this.currentDate.getMonth() && 
           day.getFullYear() === this.currentDate.getFullYear();
  }

  /**
   * Formats time for display.
   * Handles both UTC strings and time strings like "09:00:00"
   */
  formatTime(timeString: string): string {
    if (!timeString) return '';
    
    // Handle time strings like "09:00:00" or "17:00:00"
    if (timeString.includes(':') && timeString.length <= 8) {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours, 10);
      const minute = parseInt(minutes, 10);
      
      // Convert to 12-hour format
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
      
      return `${displayHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${period}`;
    }
    
    // Handle UTC date strings
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  /**
   * Formats date for display.
   */
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  /**
   * Gets formatted shift start time.
   */
  getShiftStartTime(): string {
    if (!this.selectedShift?.startTime) return 'N/A';
    return this.formatTime(this.selectedShift.startTime) || 'N/A';
  }

  /**
   * Gets formatted shift end time.
   */
  getShiftEndTime(): string {
    if (!this.selectedShift?.endTime) return 'N/A';
    return this.formatTime(this.selectedShift.endTime) || 'N/A';
  }

  /**
   * Gets shift notes.
   */
  getShiftNotes(): string {
    return this.selectedShift?.notes || 'N/A';
  }

  /**
   * Formats hour for time slots.
   */
  formatHour(hour: number): string {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  }

  /**
   * Shows event popup on click.
   */
  showEventDetails(event: CalendarEvent, mouseEvent: MouseEvent): void {
    this.clickedEvent = event;
    const instanceId = event.resource?.instanceId;
    this.selectedInstance = typeof instanceId === 'number'
      ? (this.instances.find(i => i.id === instanceId) || null)
      : null;

    const shiftId = event.resource?.shiftId;
    this.selectedShift = typeof shiftId === 'number'
      ? (this.shifts.find(s => s.id === shiftId) || null)
      : null;

    this.selectedSchedule = null;
    if (this.selectedInstance) {
      this.ensureScheduleLoaded(this.selectedInstance.shiftId, this.selectedInstance.scheduleId);
    } else if (typeof event.resource?.scheduleId === 'number' && typeof shiftId === 'number') {
      this.ensureScheduleLoaded(shiftId, event.resource.scheduleId);
    }

    const staffIds = (this.selectedInstance?.assignees || [])
      .map(a => a.staffId)
      .filter((id): id is number => typeof id === 'number');
    staffIds.forEach(staffId => this.ensureStaffNameLoaded(staffId));

    this.popupPosition = {
      x: mouseEvent.clientX,
      y: mouseEvent.clientY
    };
    this.showEventPopup = true;
  }

  /**
   * Closes event popup.
   */
  closeEventPopup(): void {
    this.showEventPopup = false;
    this.clickedEvent = null;
    this.selectedInstance = null;
    this.selectedShift = null;
    this.selectedSchedule = null;
  }

  private ensureScheduleLoaded(shiftId: number, scheduleId: number): void {
    const cached = this.scheduleCacheById.get(scheduleId);
    if (cached) {
      this.selectedSchedule = cached;
      return;
    }

    if (this.schedulesLoadingByShiftId.has(shiftId)) {
      return;
    }

    this.schedulesLoadingByShiftId.add(shiftId);
    this.scheduleService.getSchedulesForShift(shiftId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (schedules) => {
          (schedules || []).forEach(s => this.scheduleCacheById.set(s.id, s));
          this.selectedSchedule = this.scheduleCacheById.get(scheduleId) || null;
          this.schedulesLoadingByShiftId.delete(shiftId);
        },
        error: () => {
          this.schedulesLoadingByShiftId.delete(shiftId);
        }
      });
  }

  formatDateForDisplay(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getFrequencyDisplay(rRule: string | null | undefined): string {
    if (!rRule) return 'Does not repeat';

    if (rRule.includes('FREQ=DAILY')) {
      const intervalMatch = rRule.match(/INTERVAL=(\d+)/);
      const interval = intervalMatch ? parseInt(intervalMatch[1], 10) : 1;
      return interval === 1 ? 'Daily' : `Every ${interval} Days`;
    }
    if (rRule.includes('FREQ=WEEKLY')) {
      const intervalMatch = rRule.match(/INTERVAL=(\d+)/);
      const interval = intervalMatch ? parseInt(intervalMatch[1], 10) : 1;
      return interval === 1 ? 'Weekly' : `Every ${interval} Weeks`;
    }
    if (rRule.includes('FREQ=MONTHLY')) {
      const intervalMatch = rRule.match(/INTERVAL=(\d+)/);
      const interval = intervalMatch ? parseInt(intervalMatch[1], 10) : 1;
      return interval === 1 ? 'Monthly' : `Every ${interval} Months`;
    }
    if (rRule.includes('FREQ=YEARLY')) {
      const intervalMatch = rRule.match(/INTERVAL=(\d+)/);
      const interval = intervalMatch ? parseInt(intervalMatch[1], 10) : 1;
      return interval === 1 ? 'Yearly' : `Every ${interval} Years`;
    }
    return 'Custom';
  }

  getStaffDisplayName(staffId: number): string {
    // First check staff name cache
    if (this.staffNameCache.has(staffId)) {
      return this.staffNameCache.get(staffId)!;
    }
    
    // Then check the main staff array
    const staffFromMain = this.staff.find(s => s.id === staffId);
    if (staffFromMain) {
      this.staffNameCache.set(staffId, staffFromMain.name);
      return staffFromMain.name;
    }
    
    // Load staff name asynchronously if not found
    this.ensureStaffNameLoaded(staffId);
    
    return `Staff #${staffId}`;
  }

  private ensureStaffNameLoaded(staffId: number): void {
    if (this.staffNameCache.has(staffId)) return;
    this.programRoleStaffService.getStaffById(staffId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (staff) => {
          if (staff?.name) {
            this.staffNameCache.set(staffId, staff.name);
          }
        },
        error: () => {
          // ignore
        }
      });
  }

  /**
   * Gets program name for an event.
   */
  getProgramName(event: CalendarEvent): string {
    const shift = this.shifts.find(s => s.id === event.resource?.shiftId);
    if (!shift || !shift.locationId) return 'Unknown';
    
    const program = this.programs.find(p => p.id === shift.locationId);
    return program ? program.name : 'Unknown';
  }

  /**
   * Gets staff count for an event.
   */
  getStaffCount(event: CalendarEvent): number {
    const instanceId = event.resource?.instanceId;
    const inst = typeof instanceId === 'number'
      ? this.instances.find(i => i.id === instanceId)
      : undefined;
    
    // First check if instance has actual assignees
    if (inst?.assignees?.length) {
      return inst.assignees.length;
    }
    
    // If no assignees, check assignment rules
    const shiftId = event.resource?.shiftId;
    if (typeof shiftId === 'number') {
      const scheduleId = event.resource?.scheduleId;
      const rules = (this.assignmentRulesByShiftId.get(shiftId) || [])
        .filter(r => (r.status || 'published').toLowerCase() === 'published')
        .filter(r => typeof scheduleId !== 'number' || r.scheduleId === scheduleId);
      const eventDate = new Date(event.start);
      eventDate.setHours(0, 0, 0, 0); // Normalize to start of day
      
      return rules.filter(r => {
        const effectiveFrom = new Date(r.effectiveFrom);
        effectiveFrom.setHours(0, 0, 0, 0); // Normalize to start of day
        
        const effectiveTo = r.effectiveTo ? new Date(r.effectiveTo) : null;
        if (effectiveTo) {
          effectiveTo.setHours(0, 0, 0, 0); // Normalize to start of day
        }
        
        // Rule is active if event date is on or after effectiveFrom and (if has effectiveTo) on or before effectiveTo
        return eventDate >= effectiveFrom && (!effectiveTo || eventDate <= effectiveTo);
      }).length;
    }
    
    return 0;
  }

  /**
   * Gets assigned hours for an event.
   */
  getAssignedHours(event: CalendarEvent): number {
    // Prefer published assignment rules if we have them (reflects edits).
    // Instance assignee start/end times can be stale if rules were edited after instances were created.
    const shiftId = event.resource?.shiftId;
    if (typeof shiftId === 'number') {
      const scheduleId = event.resource?.scheduleId;
      const rules = (this.assignmentRulesByShiftId.get(shiftId) || [])
        .filter(r => (r.status || 'published').toLowerCase() === 'published')
        .filter(r => typeof scheduleId !== 'number' || r.scheduleId === scheduleId);

      if (rules.length > 0) {
        const eventDate = new Date(event.start);
        eventDate.setHours(0, 0, 0, 0);

        const activeRules = rules.filter(r => {
          const effectiveFrom = new Date(r.effectiveFrom);
          effectiveFrom.setHours(0, 0, 0, 0);

          const effectiveTo = r.effectiveTo ? new Date(r.effectiveTo) : null;
          if (effectiveTo) {
            effectiveTo.setHours(0, 0, 0, 0);
          }

          return eventDate >= effectiveFrom && (!effectiveTo || eventDate <= effectiveTo);
        });

        if (activeRules.length > 0) {
          return activeRules.reduce((total, rule) => {
            if (rule.startTime && rule.endTime) {
              const start = new Date(`2000-01-01T${rule.startTime}`).getTime();
              const end = new Date(`2000-01-01T${rule.endTime}`).getTime();
              const hours = (end - start) / (1000 * 60 * 60);
              return total + hours;
            }
            return total;
          }, 0);
        }
      }
    }

    const instanceId = event.resource?.instanceId;
    const inst = typeof instanceId === 'number'
      ? this.instances.find(i => i.id === instanceId)
      : undefined;
    
    // First check if instance has actual assignees
    if (inst?.assignees?.length) {
      const instStart = new Date(inst.startsAt).getTime();
      const instEnd = new Date(inst.endsAt).getTime();

      const totalMs = inst.assignees.reduce((sum, a) => {
        let start = new Date(a.startsAt).getTime();
        let end = new Date(a.endsAt).getTime();

        if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
          start = instStart;
          end = instEnd;
        }

        if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return sum;
        return sum + (end - start);
      }, 0);

      return Math.round((totalMs / (1000 * 60 * 60)) * 100) / 100;
    }
    
    return 0;
  }

  /**
   * Gets target hours for an event.
   */
  getTargetHours(event: CalendarEvent): number {
    const shift = this.shifts.find(s => s.id === event.resource?.shiftId);
    return shift?.targetHours || 0;
  }

  /**
   * Gets the color for a calendar event based on shift state and staff assignment.
   * - Grey (#808080) for Draft shifts
   * - Light pastel colors for different assignment states:
   *   - #fbb4af/#fecdd3: Empty Schedule (0 assigned hours)
   *   - #fde68a: Under Scheduled (assigned < target)
   *   - #a7f3d0: Scheduled (assigned == target)
   *   - #f0f9ff: Over Scheduled (assigned > target)
   */
  getEventColor(event: CalendarEvent): string {
    if (!event.resource || !event.resource.shiftId) return '#d3d3d3'; // Light grey for default
    
    // Find the shift for this event
    const shift = this.shifts.find(s => s.id === event.resource!.shiftId);
    if (!shift) return '#d3d3d3'; // Light grey if shift not found

    // Check if the schedule is draft (for draft schedules, show in grey)
    if (event.resource.scheduleId) {
      const schedule = this.schedules.find(s => s.id === event.resource!.scheduleId);
      if (schedule && schedule.status?.toLowerCase() === 'draft') {
        return '#808080'; // Grey color for draft schedules
      }
    }

    const assignedHours = this.getAssignedHours(event);
    const targetHours = this.getTargetHours(event);

    if (targetHours <= 0) {
      return assignedHours <= 0 ? '#fbb4af' : '#7dd89b';
    }

    if (assignedHours <= 0) return '#fecdd3';
    if (assignedHours < targetHours) return '#fde68a';
    if (assignedHours > targetHours) return '#f0f9ff';
    return '#a7f3d0';
  }

  /**
   * Gets the left border color for an event based on assigned vs target hours.
   * Returns #7dd89b when assigned hours equal target hours, #fde68a for under-scheduled, #fbb4af for no assigned hours, #f0f9ff for over-scheduled.
   */
  getEventLeftBorderColor(event: CalendarEvent): string {
    const assignedHours = this.getAssignedHours(event);
    const targetHours = this.getTargetHours(event);

    if (targetHours <= 0) {
      return assignedHours <= 0 ? (event.color || '#d3d3d3') : '#7dd89b';
    }

    if (assignedHours <= 0) return '#fbb4af'; // No assigned hours
    if (assignedHours < targetHours) return '#fde68a'; // Under-scheduled
    if (assignedHours > targetHours) return '#f0f9ff'; // Over-scheduled
    return '#7dd89b'; // When assigned hours equal target hours
  }

  /**
   * Formats date as local string (YYYY-MM-DD).
   */
  formatDateAsLocalString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Formats time string to AM/PM format.
   */
  formatTimeToAMPM(timeString: string): string {
    if (!timeString) return '';
    
    // Parse the time string (format: "HH:mm" or "HH:mm:ss")
    const parts = timeString.split(':');
    let hours = parseInt(parts[0]);
    const minutes = parts[1];
    
    // Convert to 12-hour format
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; // Convert 0 to 12
    
    return `${hours}:${minutes} ${period}`;
  }

  /**
   * Gets event background color with opacity.
   */
  getEventBackgroundColor(color: string | undefined): string {
    const hexColor = color || '#28a745';
    
    // Remove # if present
    const hex = hexColor.replace('#', '');
    
    // Convert hex to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Return rgba with 20% opacity (0.2)
    return `rgba(${r}, ${g}, ${b}, 0.2)`;
  }

  /**
   * Calculates the top position in pixels for an event in the weekly/daily view.
   * Position is based on the event's start time relative to the first time slot.
   */
  getEventTopPosition(event: CalendarEvent): number {
    const firstSlotHour = this.timeSlots.length > 0 ? this.timeSlots[0] : 0;
    const eventStart = new Date(event.start);
    const eventHour = eventStart.getHours();
    const eventMinutes = eventStart.getMinutes();

    // Each time slot is ~60px high (match view-schedules)
    const slotHeight = 61;

    const hoursFromStart = eventHour - firstSlotHour;
    const minutesOffset = eventMinutes / 60;
    const position = (hoursFromStart + minutesOffset) * slotHeight;
    return Math.max(0, position);
  }

  /**
   * Calculates the height in pixels for an event in the weekly/daily view.
   * Height is based on the event's duration.
   */
  getEventHeight(event: CalendarEvent): number {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    const durationMs = eventEnd.getTime() - eventStart.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    // Each time slot is 60px high
    const slotHeight = 60;
    const height = durationHours * slotHeight;
    return Math.max(60, height);
  }

  /**
   * Checks if two events overlap in time.
   */
  eventsOverlap(event1: CalendarEvent, event2: CalendarEvent): boolean {
    const start1 = new Date(event1.start).getTime();
    const end1 = new Date(event1.end).getTime();
    const start2 = new Date(event2.start).getTime();
    const end2 = new Date(event2.end).getTime();

    return start1 < end2 && start2 < end1;
  }

  /**
   * Gets all events that are part of the same overlapping group as the given event.
   */
  getOverlappingEventGroup(event: CalendarEvent, dayEvents: CalendarEvent[]): CalendarEvent[] {
    const group: CalendarEvent[] = [event];
    const processed = new Set<string>([event.id]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const groupEvent of group) {
        for (const otherEvent of dayEvents) {
          if (!processed.has(otherEvent.id) && this.eventsOverlap(groupEvent, otherEvent)) {
            group.push(otherEvent);
            processed.add(otherEvent.id);
            changed = true;
          }
        }
      }
    }

    return group;
  }

  /**
   * Calculates which column an event should be placed in to avoid overlaps.
   */
  getEventColumnInfo(event: CalendarEvent, dayEvents: CalendarEvent[]): { column: number; totalColumns: number } {
    const overlappingGroup = this.getOverlappingEventGroup(event, dayEvents);

    if (overlappingGroup.length === 1) {
      return { column: 0, totalColumns: 1 };
    }

    overlappingGroup.sort((a, b) => {
      const startDiff = new Date(a.start).getTime() - new Date(b.start).getTime();
      if (startDiff !== 0) return startDiff;
      return a.id.localeCompare(b.id);
    });

    const eventColumns = new Map<string, number>();
    const columnEndTimes: number[] = [];

    for (const evt of overlappingGroup) {
      const evtStart = new Date(evt.start).getTime();
      const evtEnd = new Date(evt.end).getTime();

      let assignedColumn = -1;
      for (let col = 0; col < columnEndTimes.length; col++) {
        if (columnEndTimes[col] <= evtStart) {
          assignedColumn = col;
          columnEndTimes[col] = evtEnd;
          break;
        }
      }

      if (assignedColumn === -1) {
        assignedColumn = columnEndTimes.length;
        columnEndTimes.push(evtEnd);
      }

      eventColumns.set(evt.id, assignedColumn);
    }

    const totalColumns = columnEndTimes.length;
    const column = eventColumns.get(event.id) || 0;
    return { column, totalColumns };
  }

  /**
   * Calculates the width (in percentage) for an event based on number of overlapping events.
   */
  getEventWidth(event: CalendarEvent, day: Date): number {
    const dayEvents = this.getEventsForDay(day);
    const { totalColumns } = this.getEventColumnInfo(event, dayEvents);

    if (totalColumns === 1) {
      return 100;
    }

    const gapPercent = 1;
    const totalGaps = (totalColumns - 1) * gapPercent;
    const availableWidth = 100 - totalGaps;
    return availableWidth / totalColumns;
  }

  /**
   * Calculates the left position (in percentage) for an event based on its column.
   */
  getEventLeftPosition(event: CalendarEvent, day: Date): number {
    const dayEvents = this.getEventsForDay(day);
    const { column, totalColumns } = this.getEventColumnInfo(event, dayEvents);

    if (totalColumns === 1) {
      return 0;
    }

    const gapPercent = 1;
    const totalGaps = (totalColumns - 1) * gapPercent;
    const availableWidth = 100 - totalGaps;
    const eventWidth = availableWidth / totalColumns;

    return (column * eventWidth) + (column * gapPercent);
  }

  /**
   * Loads assignment rules for a shift.
   */
  loadAssignmentRulesForShift(shiftId: number): Promise<void> {
    return this.scheduleService.getAssignmentRules(shiftId)
      .pipe(takeUntil(this.destroy$))
      .toPromise()
      .then(rules => {
        if (rules) {
          this.assignmentRulesByShiftId.set(shiftId, rules);
        }
      })
      .catch(error => {
        console.error(`Error loading assignment rules for shift ${shiftId}:`, error);
      });
  }
  
  /**
   * Loads assignment rules for multiple shifts in parallel.
   * Stores them in assignmentRulesByShiftId map for quick access.
   */
  loadAssignmentRulesForShifts(shiftIds: number[]): Promise<void> {
    if (!shiftIds || shiftIds.length === 0) {
      return Promise.resolve();
    }
    
    // Create array of API calls for all shiftIds
    const ruleCalls = shiftIds.map(shiftId => 
      this.scheduleService.getAssignmentRules(shiftId).pipe(
        takeUntil(this.destroy$)
      )
    );
    
    // Load all rules in parallel
    return forkJoin(ruleCalls)
      .pipe(takeUntil(this.destroy$))
      .toPromise()
      .then((rulesArrays: AssignmentRule[][] | undefined) => {
        if (!rulesArrays) {
          console.log('Readonly calendar - loadAssignmentRulesForShifts: No rules arrays returned');
          return;
        }
        
        // Store rules in map by shiftId
        shiftIds.forEach((shiftId, index) => {
          const rules = rulesArrays[index] || [];
          this.assignmentRulesByShiftId.set(shiftId, rules);
          console.log(`Readonly calendar - Loaded ${rules.length} assignment rules for shiftId ${shiftId}`);
        });
        
        console.log(`Readonly calendar - Total assignment rules loaded for ${shiftIds.length} shifts`);
      })
      .catch((error) => {
        console.error('Readonly calendar - Error loading assignment rules for shifts:', error);
        // Continue even if some rules fail to load
      }) as Promise<void>;
  }

  /**
   * Gets staff assignments for an event, checking both instance assignees and assignment rules.
   */
  getStaffAssignmentsForEvent(event: CalendarEvent): Array<{ staffId: number; staffName: string; roleName: string; startTime: string; endTime: string; assignedHours: number }> {
    const assignments: Array<{ staffId: number; staffName: string; roleName: string; startTime: string; endTime: string; assignedHours: number }> = [];

    const getRoleName = (staffId: number): string => {
      const staffMember = this.staff.find(s => s.id === staffId);
      if (!staffMember) return 'Staff';
      const role = this.roles.find(r => r.id === staffMember.roleId);
      return role?.name || 'Staff';
    };

    const computeHoursFromIso = (startIso: string | null | undefined, endIso: string | null | undefined): number => {
      if (!startIso || !endIso) return 0;
      const start = new Date(startIso);
      const end = new Date(endIso);
      const diffMs = end.getTime() - start.getTime();
      if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
      return diffMs / (1000 * 60 * 60);
    };

    const computeHoursFromTimeStrings = (startTimeStr: string | null | undefined, endTimeStr: string | null | undefined): number => {
      if (!startTimeStr || !endTimeStr) return 0;
      const parse = (t: string): { h: number; m: number } | null => {
        const parts = t.split(':');
        if (parts.length < 2) return null;
        const h = Number(parts[0]);
        const m = Number(parts[1]);
        if (Number.isNaN(h) || Number.isNaN(m)) return null;
        return { h, m };
      };
      const s = parse(startTimeStr);
      const e = parse(endTimeStr);
      if (!s || !e) return 0;
      let startMinutes = s.h * 60 + s.m;
      let endMinutes = e.h * 60 + e.m;
      if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60;
      }
      return (endMinutes - startMinutes) / 60;
    };
    
    // First check if instance has actual assignees
    const instanceId = event.resource?.instanceId;
    if (typeof instanceId === 'number') {
      const instance = this.instances.find(i => i.id === instanceId);
      if (instance?.assignees?.length) {
        instance.assignees.forEach(a => {
          if (typeof a.staffId === 'number') {
            assignments.push({
              staffId: a.staffId,
              staffName: this.getStaffDisplayName(a.staffId),
              roleName: getRoleName(a.staffId),
              startTime: this.formatTime(a.startsAt),
              endTime: this.formatTime(a.endsAt),
              assignedHours: computeHoursFromIso(a.startsAt, a.endsAt)
            });
          }
        });
        return assignments;
      }
    }
    
    // If no assignees, check assignment rules
    const shiftId = event.resource?.shiftId;
    if (typeof shiftId === 'number') {
      const rules = (this.assignmentRulesByShiftId.get(shiftId) || [])
        .filter(r => (r.status || 'published').toLowerCase() === 'published');
      const eventDate = new Date(event.start);
      eventDate.setHours(0, 0, 0, 0); // Normalize to start of day
      
      // Filter rules effective on the event date (same logic as getStaffCount)
      const effectiveRules = rules.filter(r => {
        const effectiveFrom = new Date(r.effectiveFrom);
        effectiveFrom.setHours(0, 0, 0, 0); // Normalize to start of day
        
        const effectiveTo = r.effectiveTo ? new Date(r.effectiveTo) : null;
        if (effectiveTo) {
          effectiveTo.setHours(0, 0, 0, 0); // Normalize to start of day
        }
        
        // Rule is active if event date is on or after effectiveFrom and (if has effectiveTo) on or before effectiveTo
        return eventDate >= effectiveFrom && (!effectiveTo || eventDate <= effectiveTo);
      });
      
      effectiveRules.forEach(rule => {
        const staffId = rule.staffId!;
        const rawStart = (rule.startTime || '').substring(0, 5);
        const rawEnd = (rule.endTime || '').substring(0, 5);
        assignments.push({
          staffId,
          staffName: this.getStaffDisplayName(staffId),
          roleName: getRoleName(staffId),
          startTime: this.formatTime(rule.startTime || ''),
          endTime: this.formatTime(rule.endTime || ''),
          assignedHours: computeHoursFromTimeStrings(rawStart, rawEnd)
        });
      });
    }
    
    return assignments;
  }

  /**
   * Loads assignment rules for all shifts.
   */
  async loadAssignmentRulesForAllShifts(): Promise<void> {
    const shiftIds = this.shifts.map(s => s.id);
    if (shiftIds.length === 0) return;

    try {
      const rulesPromises = shiftIds.map(shiftId => 
        this.scheduleService.getAssignmentRules(shiftId).pipe(takeUntil(this.destroy$)).toPromise()
      );
      
      const rulesArrays = await Promise.all(rulesPromises);
      
      rulesArrays.forEach((rules, index) => {
        if (rules) {
          this.assignmentRulesByShiftId.set(shiftIds[index], rules);
        }
      });
    } catch (error) {
      console.error('Error loading assignment rules:', error);
    }
  }
  openAssignStaffModal(): void {
    if (!this.selectedInstance) return;

    const shift = this.shifts.find((s) => s.id === this.selectedInstance!.shiftId);
    if (!shift?.locationId) {
      this.toastService.showError('No program associated with this shift');
      return;
    }

    this.staffModalMode = 'instance';
    this.staffModalFrequencyRRule = this.selectedSchedule?.rRule ?? null;
    this.staffAssignments =
      this.selectedInstance.assignees?.map((a) => this.mapAssigneeToStaffRow(a)) ?? [];
    this.newStaffAssignment = false;
    this.currentStaffAssignment = null;
    this.editingStaffAssignmentIndex = null;

    this.programRoleStaffService
      .getStaff(shift.locationId, null)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (staff: Staff[]) => {
          this.availableStaff = staff || [];
          this.assignStaffForm.reset();
          this.filterStaffList();
          this.showStaffAssignmentModal = true;
        },
        error: () => {
          this.toastService.showError('Failed to load staff list');
        }
      });
  }

  /**
   * Assigns the selected staff to the instance.
   */
  assignStaff(): void {
    if (!this.selectedInstance || !this.assignStaffForm.valid) return;

    const staffId = this.assignStaffForm.get('staffId')?.value;
    if (!staffId) return;

    this.isAssigningStaff = true;
    const request: UpdateAssigneesRequest = { staffIds: [staffId] };

    this.scheduleService.addAssignees(this.selectedInstance.id, request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Staff assigned successfully');
          this.closeStaffAssignmentModal();
          this.loadCalendarOccurrences(); // Refresh calendar to show updated staff
        },
        error: (error) => {
          console.error('Error assigning staff:', error);
          this.toastService.showError('Failed to assign staff');
        }
      })
      .add(() => {
        this.isAssigningStaff = false;
      });
  }

  /**
   * Removes all staff from the instance.
   */
  removeAllStaff(): void {
    if (!this.selectedInstance) return;

    const staffIds = this.selectedInstance.assignees?.map(a => a.staffId) || [];
    if (staffIds.length === 0) return;

    this.isAssigningStaff = true;
    const request: UpdateAssigneesRequest = { staffIds };

    this.scheduleService.removeAssignees(this.selectedInstance.id, request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('All staff removed successfully');
          this.loadCalendarOccurrences(); // Refresh calendar to show updated staff
        },
        error: (error) => {
          console.error('Error removing staff:', error);
          this.toastService.showError('Failed to remove staff');
        }
      })
      .add(() => {
        this.isAssigningStaff = false;
      });
  }

  /**
   * Gets resolved assignees for a shift on a specific date.
   */
  async getResolvedAssigneesForDate(shiftId: number, date: Date): Promise<Assignee[]> {
    try {
      const dateStr = this.formatDateAsLocalString(date);
      const assignees = await firstValueFrom(
        this.scheduleService.getResolvedAssignees(shiftId, dateStr)
      );
      return assignees;
    } catch (error) {
      console.error('Error fetching resolved assignees:', error);
      return [];
    }
  }

  /**
   * Gets assignment rules for a shift on a specific date.
   */
  async getAssignmentRulesForDate(shiftId: number, date: Date): Promise<AssignmentRule[]> {
    try {
      const dateStr = this.formatDateAsLocalString(date);
      const rules = await firstValueFrom(
        this.scheduleService.getEffectiveAssignmentRules(shiftId, dateStr)
      );
      return rules;
    } catch (error) {
      console.error('Error fetching assignment rules:', error);
      return [];
    }
  }

  /**
   * Gets total assigned hours for an instance.
   */
  getTotalAssignedHours(instance: Instance): number {
    if (!instance.assignees || instance.assignees.length === 0) {
      return 0;
    }
    
    return instance.assignees.reduce((total, assignee) => {
      const hours = assignee.endsAt && assignee.startsAt 
        ? this.calculateDuration(assignee.startsAt, assignee.endsAt)
        : 0;
      return total + hours;
    }, 0);
  }

  /**
   * Gets assignee names for display in calendar events.
   */
  getAssigneeNames(instance: Instance): string {
    if (!instance.assignees || instance.assignees.length === 0) {
      return 'Unassigned';
    }
    
    return instance.assignees
      .map(assignee => this.getStaffName(assignee.staffId))
      .join(', ');
  }

  /**
   * Gets staff name by ID from the staff list.
   */
  getStaffName(staffId: number): string {
    const staff = this.staff.find(s => s.id === staffId);
    return staff ? staff.name : `Staff ${staffId}`;
  }

  /**
   * Gets staff role by ID from the staff list.
   */
  getStaffRole(staffId: number): string {
    const staff = this.staff.find(s => s.id === staffId);
    return staff ? staff.roleName : 'Unknown';
  }

  /**
   * Gets assignment summary for display.
   */
  getAssignmentSummary(instance: Instance): string {
    const totalHours = this.getTotalAssignedHours(instance);
    const assigneeCount = instance.assignees?.length || 0;
    
    if (assigneeCount === 0) {
      return 'No staff assigned';
    }
    
    const names = this.getAssigneeNames(instance);
    const shortNames = names.length > 50 ? names.substring(0, 47) + '...' : names;
    
    return `${assigneeCount} staff (${totalHours}h): ${shortNames}`;
  }

  readonly canCreateSchedules = true;
  readonly canEditSchedules = true;
  readonly canAssignStaff = true;
  readonly canUnassignStaff = true;
  readonly canDeleteSchedules = true;
  readonly hasDraftAssignmentChanges = false;
  readonly draftAssignmentRules: unknown[] = [];
  readonly isPublishingAssignmentDraft = false;

  hasScheduleFormChangesFn = (): boolean => this.scheduleForm.dirty;

  getProgramNameForShiftFn = (shift: Shift | null): string =>
    shift ? this.getLocationName(shift.locationId ?? null) || '—' : '—';

  getShiftTimeRangeFn = (shift: Shift | null): string => {
    if (!shift?.startTime || !shift?.endTime) return '—';
    return `${this.formatTimeToAMPM(shift.startTime)} – ${this.formatTimeToAMPM(shift.endTime)}`;
  };

  getUpdatedByInfoFn = (_schedule: Schedule | null): string | null => null;

  getStaffNameFn = (staffId: number): string => this.getStaffName(staffId);

  getMinRepeatUntilDateFn = (): string => this.getMinRepeatUntilDate();

  getFrequencySelectedIdFn = (): number | null => this.getFrequencySelectedId();

  getRepeatEverySelectedIdFn = (): number | null => this.getRepeatEverySelectedId();

  isWeekDaySelectedFn = (dayIndex: number): boolean => this.isWeekDaySelected(dayIndex);

  toggleWeekDayFn = (dayIndex: number): void => this.toggleWeekDay(dayIndex);

  getMonthDaysFn = (): number[] => this.getMonthDays();

  isMonthDaySelectedFn = (day: number): boolean => this.isMonthDaySelected(day);

  toggleMonthDayFn = (day: number): void => this.toggleMonthDay(day);

  getRepeatEveryDisplayFn = (rrule: string | null | undefined): string =>
    this.getFrequencyDisplay(rrule || undefined);

  getProgramNameByLocationIdFn = (locationId?: number | null): string =>
    this.getLocationName(locationId ?? null) || 'N/A';

  calculateTotalAssignedHoursFn = (): number => {
    let sum = 0;
    for (const a of this.staffAssignments || []) {
      sum += this.getAssignmentHoursForRow(a);
    }
    return sum;
  };

  calculateRemainingHoursFn = (): number => {
    const target = this.selectedSchedule?.targetHours ?? this.selectedShift?.targetHours ?? 0;
    return Math.max(0, (Number(target) || 0) - this.calculateTotalAssignedHoursFn());
  };

  getAssignmentHoursFn = (assignment: any): number => this.getAssignmentHoursForRow(assignment);

  isStaffAssignmentDraftFn = (_assignment: any): boolean => false;

  isSingleOccurrenceNoParentScheduleForAssignmentFn = (): boolean => false;

  getSingleOccurrenceDateForAssignmentFn = (): string | Date => {
    const ev = this.clickedEvent;
    if (!ev) return new Date();
    return schedFormatDate(
      new Date(ev.start.getFullYear(), ev.start.getMonth(), ev.start.getDate())
    );
  };

  getScheduleInstanceDatesFn = (): string[] => {
    const d = this.getSingleOccurrenceDateForAssignmentFn();
    return typeof d === 'string' ? [d] : [];
  };

  getDateDisplayTextFn = (value: any): string => this.formatDateForDisplay(value);

  get isOvernightShiftForModal(): boolean {
    const s = this.selectedShift;
    if (!s?.startTime || !s?.endTime) return false;
    return this.parseTimeToMinutesLocal(s.endTime) <= this.parseTimeToMinutesLocal(s.startTime);
  }

  private parseTimeToMinutesLocal(t: string): number {
    const p = (t || '').split(':');
    const h = parseInt(p[0] || '0', 10);
    const m = parseInt(p[1] || '0', 10);
    return h * 60 + m;
  }

  private getAssignmentHoursForRow(assignment: any): number {
    const a = (assignment?.startTime || '09:00').toString();
    const b = (assignment?.endTime || '17:00').toString();
    const sm = this.parseTimeToMinutesLocal(a.length >= 5 ? a.substring(0, 5) : a);
    const em = this.parseTimeToMinutesLocal(b.length >= 5 ? b.substring(0, 5) : b);
    let diff = em - sm;
    if (diff <= 0) diff += 24 * 60;
    return diff / 60;
  }

  onScheduleProgramChange(programId: number | null): void {
    this.scheduleForm.get('programId')?.setValue(programId);
    this.scheduleForm.get('programId')?.markAsDirty();
  }

  onIcmCreateScheduleClick(): void {
    void this.createScheduleFromModal();
  }

  onIcmSaveScheduleDraft(): void {
    void this.updateScheduleFromModal();
  }

  filterStaffList(): void {
    const q = (this.staffSearchQuery || '').trim().toLowerCase();
    this.filteredStaffList = (this.availableStaff || [])
      .filter(
        (s) =>
          !q ||
          (s.name || '').toLowerCase().includes(q) ||
          (s.roleName || '').toLowerCase().includes(q)
      )
      .map((s) => ({ id: s.id, name: s.name, role: s.roleName || '' }));
  }

  addStaffToAssignment(staff: { id: number; name?: string; role?: string }): void {
    if (!this.currentStaffAssignment) {
      this.currentStaffAssignment = {};
    }
    this.currentStaffAssignment = { ...this.currentStaffAssignment, staffId: staff.id };
    this.showStaffDropdown = false;
    this.staffSearchQuery = '';
  }

  startNewStaffAssignmentFromIcm(): void {
    const shift = this.selectedShift;
    const ev = this.clickedEvent;
    const dateStr = ev
      ? schedFormatDate(new Date(ev.start.getFullYear(), ev.start.getMonth(), ev.start.getDate()))
      : schedFormatDate(new Date());
    const st = (shift?.startTime || '09:00:00').substring(0, 5);
    const en = (shift?.endTime || '17:00:00').substring(0, 5);
    this.newStaffAssignment = true;
    this.editingStaffAssignmentIndex = null;
    this.currentStaffAssignment = {
      staffId: null,
      startTime: st,
      endTime: en,
      effectiveFrom: dateStr,
      effectiveTo: null
    };
  }

  cancelStaffAssignmentFormFromIcm(): void {
    this.newStaffAssignment = false;
    this.editingStaffAssignmentIndex = null;
    this.currentStaffAssignment = null;
    this.staffSearchQuery = '';
    this.showStaffDropdown = false;
  }

  onStaffAssignmentFieldChangeFromIcm(e: { field: string; value: any }): void {
    this.currentStaffAssignment = {
      ...(this.currentStaffAssignment || {}),
      [e.field]: e.value
    };
  }

  saveStaffAssignmentFormFromIcm(): void {
    const cur = this.currentStaffAssignment;
    if (!cur || typeof cur['staffId'] !== 'number') {
      this.toastService.showError('Select a staff member.');
      return;
    }
    const staffId = cur['staffId'] as number;
    if (this.staffModalMode === 'instance') {
      this.assignStaffForm.patchValue({ staffId });
      this.assignStaff();
      return;
    }
    if (this.staffModalMode === 'rule') {
      const st = (cur['startTime'] as string) || '09:00';
      const en = (cur['endTime'] as string) || '17:00';
      this.ruleStaffForm.patchValue({
        staffId,
        startTime: st.length === 5 ? st : st.substring(0, 5),
        endTime: en.length === 5 ? en : en.substring(0, 5)
      });
      this.submitRuleStaffModal();
    }
  }

  closeStaffAssignmentModalFromIcm(): void {
    this.closeStaffAssignmentModal();
  }

  closeStaffAssignmentModal(): void {
    this.showStaffAssignmentModal = false;
    this.staffModalMode = null;
    this.staffAssignments = [];
    this.currentStaffAssignment = null;
    this.newStaffAssignment = false;
    this.editingStaffAssignmentIndex = null;
    this.staffSearchQuery = '';
    this.showStaffDropdown = false;
    this.filteredStaffList = [];
    this.staffModalFrequencyRRule = null;
    this.assignStaffForm.reset();
    this.ruleStaffForm.reset({
      staffId: null,
      startTime: '09:00',
      endTime: '17:00'
    });
  }

  removeStaffAssignmentFromIcm(_index: number): void {
    this.toastService.showError('Remove staff from the main app for now.');
  }

  editStaffAssignmentFromIcm(_index: number): void {
    /* read-only list in custom calendar */
  }

  publishDraftAssignmentRulesFromIcm(): void {
    /* not used in custom calendar */
  }

  private mapAssigneeToStaffRow(a: Assignee): any {
    const start = this.extractHHmmFromIso(a.startsAt);
    const end = this.extractHHmmFromIso(a.endsAt);
    const day = this.extractDateFromIso(a.startsAt);
    return {
      staffId: a.staffId,
      startTime: start,
      endTime: end,
      effectiveFrom: day,
      effectiveTo: null,
      displayEffectiveFrom: day,
      displayEffectiveTo: null
    };
  }

  private extractHHmmFromIso(iso: string): string {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '09:00';
      const h = d.getHours().toString().padStart(2, '0');
      const m = d.getMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    } catch {
      return '09:00';
    }
  }

  private extractDateFromIso(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return schedFormatDate(new Date());
    return schedFormatDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  }

  // --- Schedule create / edit (StaffScheduler-aligned) ---

  onShiftDragStart(ev: DragEvent, shift: Shift): void {
    if (!ev.dataTransfer) return;
    this.pendingDragShift = shift;
    ev.dataTransfer.effectAllowed = 'copy';
    ev.dataTransfer.setData('text/plain', `shift-${shift.id}`);
    if (ev.target instanceof HTMLElement) ev.target.style.opacity = '0.5';
  }

  onShiftDragEnd(ev: DragEvent): void {
    if (ev.target instanceof HTMLElement) ev.target.style.opacity = '1';
    this.dragOverDay = null;
  }

  onCalendarDayDrop(day: Date): void {
    const shift = this.pendingDragShift;
    this.pendingDragShift = null;
    if (!shift) return;
    const d = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) {
      this.toastService.showError('Cannot schedule in the past.');
      return;
    }
    this.draggedShift = shift;
    this.dropDate = d;
    this.isEditingScheduleInModal = false;
    this.selectedSchedule = null;
    this.editStartDate = null;
    const dateStr = this.formatDateAsLocalString(d);
    this.scheduleForm.reset();
    this.scheduleForm.patchValue({
      programId: shift.locationId ?? null,
      targetHours: shift.targetHours ?? 8,
      frequency: 'none',
      repeatUntil: dateStr,
      repeatEvery: 'day',
      customRepeatInterval: 1,
      monthlyRepeatOption: null,
      selectedWeekDays: [],
      selectedMonthDays: []
    });
    this.scheduleForm.get('programId')?.updateValueAndValidity();
    this.scheduleForm.markAsPristine();
    this.showScheduleModal = true;
  }

  closeScheduleModal(): void {
    this.showScheduleModal = false;
    this.isEditingScheduleInModal = false;
    this.draggedShift = null;
    this.dropDate = null;
    this.editStartDate = null;
    this.isSavingSchedule = false;
    this.scheduleForm.reset({
      programId: null,
      targetHours: 8,
      frequency: 'none',
      repeatUntil: '',
      repeatEvery: 'day',
      customRepeatInterval: 1,
      customEndOption: null,
      customOccurrences: null,
      monthlyRepeatOption: null,
      selectedWeekDays: [],
      selectedMonthDays: []
    });
  }

  private getScheduleFormSnapshot(): ScheduleFormSnapshot {
    const v = this.scheduleForm.getRawValue();
    return {
      frequency: v.frequency,
      repeatEvery: v.repeatEvery,
      repeatUntil: v.repeatUntil,
      customRepeatInterval: v.customRepeatInterval,
      customEndOption: v.customEndOption ?? null,
      customOccurrences: v.customOccurrences ?? null,
      monthlyRepeatOption: v.monthlyRepeatOption,
      selectedWeekDays: v.selectedWeekDays || [],
      selectedMonthDays: v.selectedMonthDays || []
    };
  }

  getFrequencySelectedId(): number | null {
    const value = this.scheduleForm.get('frequency')?.value;
    const m = this.frequencyOptions.find((o) => o.value === value);
    return m ? m.id : null;
  }

  getRepeatEverySelectedId(): number | null {
    const value = this.scheduleForm.get('repeatEvery')?.value;
    const m = this.repeatEveryOptions.find((o) => o.value === value);
    return m ? m.id : null;
  }

  onScheduleFrequencyChange(optionId: number | null): void {
    const value = this.frequencyOptions.find((o) => o.id === optionId)?.value ?? 'none';
    this.scheduleForm.get('frequency')?.setValue(value);
    const re = setRepeatEveryForFrequency(value);
    this.scheduleForm.get('repeatEvery')?.setValue(re);
  }

  onScheduleRepeatEveryChange(optionId: number | null): void {
    const value = this.repeatEveryOptions.find((o) => o.id === optionId)?.value ?? 'day';
    this.scheduleForm.get('repeatEvery')?.setValue(value);
  }

  toggleWeekDay(dayIndex: number): void {
    const cur = [...(this.scheduleForm.get('selectedWeekDays')?.value || [])];
    const i = cur.indexOf(dayIndex);
    if (i > -1) cur.splice(i, 1);
    else cur.push(dayIndex);
    this.scheduleForm.patchValue({ selectedWeekDays: cur });
  }

  isWeekDaySelected(dayIndex: number): boolean {
    return (this.scheduleForm.get('selectedWeekDays')?.value || []).includes(dayIndex);
  }

  toggleMonthDay(day: number): void {
    const cur = [...(this.scheduleForm.get('selectedMonthDays')?.value || [])];
    const i = cur.indexOf(day);
    if (i > -1) cur.splice(i, 1);
    else cur.push(day);
    this.scheduleForm.patchValue({ selectedMonthDays: cur });
  }

  isMonthDaySelected(day: number): boolean {
    return (this.scheduleForm.get('selectedMonthDays')?.value || []).includes(day);
  }

  getMonthDays(): number[] {
    return Array.from({ length: 31 }, (_, i) => i + 1);
  }

  getMinRepeatUntilDate(): string {
    const ref = this.dropDate || this.editStartDate || new Date();
    return this.formatDateAsLocalString(ref);
  }

  private rRuleToFrequency(rrule: string): { frequency: string; repeatEvery: string } {
    const u = (rrule || '').toUpperCase();
    if (u.includes('COUNT=1') && u.includes('FREQ=DAILY')) return { frequency: 'none', repeatEvery: 'day' };
    if (u.includes('FREQ=DAILY')) return { frequency: 'daily', repeatEvery: 'day' };
    if (u.includes('FREQ=WEEKLY')) return { frequency: 'weekly', repeatEvery: 'week' };
    if (u.includes('FREQ=MONTHLY')) return { frequency: 'monthly', repeatEvery: 'month' };
    if (u.includes('FREQ=YEARLY')) return { frequency: 'daily', repeatEvery: 'day' };
    return { frequency: 'none', repeatEvery: 'day' };
  }

  async openEditScheduleFromEvent(): Promise<void> {
    const clicked = this.clickedEvent;
    this.closeEventPopup();
    if (!clicked?.resource?.shiftId || !clicked.resource.scheduleId) {
      this.toastService.showError('No schedule to edit for this event.');
      return;
    }
    const shiftId = clicked.resource.shiftId;
    const scheduleId = clicked.resource.scheduleId;
    const shift = this.shifts.find((s) => s.id === shiftId) || null;
    if (!shift) {
      this.toastService.showError('Shift not found.');
      return;
    }
    this.draggedShift = shift;
    this.editStartDate = new Date(clicked.start);
    this.dropDate = new Date(clicked.start.getFullYear(), clicked.start.getMonth(), clicked.start.getDate());

    try {
      let schedule = await firstValueFrom(this.scheduleService.getScheduleById(scheduleId));
      if ((schedule.status || '').toLowerCase() === 'published') {
        const targetDate = schedFormatDate(
          new Date(clicked.start.getFullYear(), clicked.start.getMonth(), clicked.start.getDate())
        );
        const draftRes = await firstValueFrom(
          this.scheduleService.createDraftFromPublished(scheduleId, {
            scope: EditScope.ThisAndAllFuture,
            targetDate,
            locationId: schedule.locationId ?? shift.locationId ?? null
          })
        );
        schedule = await firstValueFrom(this.scheduleService.getScheduleById(draftRes.draftScheduleId));
      }

      this.selectedSchedule = schedule;
      this.isEditingScheduleInModal = true;
      const { frequency, repeatEvery } = this.rRuleToFrequency(schedule.rRule || '');
      const until =
        schedule.until ||
        schedFormatDate(parseDateOnlyAsLocalDate(schedule.dtStartLocal) || new Date(schedule.dtStartLocal));
      this.scheduleForm.patchValue({
        programId: schedule.locationId ?? shift.locationId ?? null,
        targetHours: schedule.targetHours ?? shift.targetHours ?? 8,
        frequency,
        repeatUntil: until,
        repeatEvery,
        customRepeatInterval: 1,
        monthlyRepeatOption: null,
        selectedWeekDays: [],
        selectedMonthDays: []
      });
      this.showScheduleModal = true;
      this.scheduleForm.markAsPristine();
    } catch (e) {
      console.error(e);
      this.toastService.showError('Could not open schedule for editing.');
    }
  }

  private async createScheduleFromModal(): Promise<void> {
    if (!this.draggedShift || !this.dropDate) {
      this.toastService.showError('Missing shift or date.');
      return;
    }
    const formValue = this.scheduleForm.getRawValue();
    if (!formValue.programId) {
      this.toastService.showError('Select a program.');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dropOnly = new Date(this.dropDate);
    dropOnly.setHours(0, 0, 0, 0);
    if (dropOnly < today) {
      this.toastService.showError('Cannot create schedule in the past.');
      return;
    }

    const snap = this.getScheduleFormSnapshot();
    const resolvedUntil = resolveScheduleEndDate(snap, this.dropDate);
    if (formValue.frequency && formValue.frequency !== 'none' && !resolvedUntil) {
      this.toastService.showError('Repeat until is required for recurring schedules.');
      return;
    }

    const startTime = this.draggedShift.startTime || '09:00:00';
    const endTime = this.draggedShift.endTime || '17:00:00';
    const durationMinutes = calculateShiftDurationMinutes(startTime, endTime);
    const rRule = convertFrequencyToRRule(snap, formValue.frequency, formValue.repeatEvery, this.dropDate);
    const newDates = getNewScheduleOccurrenceDates(this.dropDate, resolvedUntil, rRule);
    const conflict = findScheduleConflict(
      this.schedules,
      this.shifts,
      this.draggedShift.id,
      formValue.programId,
      startTime,
      endTime,
      newDates
    );
    if (conflict) {
      this.toastService.showError('A schedule for this shift and program already exists on overlapping dates/times.');
      return;
    }

    const request: CreateScheduleRequest = {
      locationId: formValue.programId,
      timezone: getUserTimezone(),
      targetHours: formValue.targetHours ?? this.draggedShift.targetHours ?? 8,
      dtStartLocal: schedFormatDate(this.dropDate),
      durationMinutes,
      rRule,
      until: resolvedUntil ?? undefined
    };

    this.isSavingSchedule = true;
    this.scheduleService
      .createSchedule(this.draggedShift.id, request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Schedule created.');
          this.closeScheduleModal();
          this.loadCalendarOccurrences();
        },
        error: (err) => {
          console.error(err);
          this.toastService.showError('Failed to create schedule.');
        }
      })
      .add(() => {
        this.isSavingSchedule = false;
      });
  }

  private async updateScheduleFromModal(): Promise<void> {
    if (!this.selectedSchedule || !this.draggedShift) return;
    const formValue = this.scheduleForm.getRawValue();
    const snap = this.getScheduleFormSnapshot();
    const start = this.editStartDate || this.dropDate || new Date(this.selectedSchedule.dtStartLocal);
    const resolvedUntil = resolveScheduleEndDate(snap, start);
    const startTime = this.draggedShift.startTime || '09:00:00';
    const endTime = this.draggedShift.endTime || '17:00:00';
    const durationMinutes = calculateShiftDurationMinutes(startTime, endTime);
    const rRule = convertFrequencyToRRule(snap, formValue.frequency, formValue.repeatEvery, start);
    const dtLocal = `${schedFormatDate(start)}T${(startTime.length >= 8 ? startTime : startTime + ':00').substring(0, 8)}`;

    const request: UpdateScheduleRequest = {
      locationId: formValue.programId,
      timezone: getUserTimezone(),
      targetHours: formValue.targetHours,
      dtStartLocal: dtLocal,
      durationMinutes,
      rRule,
      until: resolvedUntil
    };

    this.isSavingSchedule = true;
    this.scheduleService
      .updateSchedule(this.draggedShift.id, this.selectedSchedule.id, request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Schedule updated.');
          this.closeScheduleModal();
          this.loadCalendarOccurrences();
        },
        error: (err) => {
          console.error(err);
          this.toastService.showError('Failed to update schedule.');
        }
      })
      .add(() => {
        this.isSavingSchedule = false;
      });
  }

  /**
   * Opens staff flow: instance assignees when instance exists; otherwise assignment rule for schedule.
   */
  openStaffForEvent(): void {
    const ev = this.clickedEvent;
    this.closeEventPopup();
    if (!ev) return;
    const instanceId = ev.resource?.instanceId;
    const scheduleId = ev.resource?.scheduleId;
    const shiftId = ev.resource?.shiftId;
    if (typeof instanceId === 'number') {
      this.clickedEvent = ev;
      this.selectedInstance = this.instances.find((i) => i.id === instanceId) || null;
      this.selectedShift = typeof shiftId === 'number' ? this.shifts.find((s) => s.id === shiftId) || null : null;
      this.openAssignStaffModal();
      return;
    }
    if (typeof scheduleId === 'number' && typeof shiftId === 'number') {
      this.clickedEvent = ev;
      void this.openAssignStaffRuleModal(shiftId, scheduleId);
      return;
    }
    this.toastService.showError('Staff cannot be added to this event type.');
  }

  ruleStaffForm: FormGroup;
  private ruleModalShiftId: number | null = null;
  private ruleModalScheduleId: number | null = null;

  private async openAssignStaffRuleModal(shiftId: number, scheduleId: number): Promise<void> {
    const shift = this.shifts.find((s) => s.id === shiftId);
    if (!shift?.locationId) {
      this.toastService.showError('No program for this shift.');
      return;
    }
    this.ruleModalShiftId = shiftId;
    this.ruleModalScheduleId = scheduleId;
    this.staffModalMode = 'rule';

    let schedule: Schedule | null = this.selectedSchedule;
    try {
      schedule = await firstValueFrom(this.scheduleService.getScheduleById(scheduleId));
    } catch {
      /* use cached */
    }
    this.selectedSchedule = schedule;
    this.selectedShift = shift;
    this.staffModalFrequencyRRule = schedule?.rRule ?? null;

    try {
      const rules = await firstValueFrom(this.scheduleService.getAssignmentRules(shiftId));
      this.staffAssignments = (rules || [])
        .filter((r) => (r.scheduleId ?? scheduleId) === scheduleId)
        .map((r: AssignmentRule) => ({
          staffId: r.staffId,
          startTime: (r.startTime || '09:00:00').substring(0, 5),
          endTime: (r.endTime || '17:00:00').substring(0, 5),
          effectiveFrom: r.effectiveFrom,
          effectiveTo: r.effectiveTo ?? null,
          displayEffectiveFrom: r.effectiveFrom,
          displayEffectiveTo: r.effectiveTo ?? null,
          id: r.id
        }));
    } catch {
      this.staffAssignments = [];
    }

    this.newStaffAssignment = false;
    this.currentStaffAssignment = null;
    this.editingStaffAssignmentIndex = null;

    const st = (shift.startTime || '09:00:00').substring(0, 5);
    const en = (shift.endTime || '17:00:00').substring(0, 5);
    this.ruleStaffForm.patchValue({
      staffId: null,
      startTime: st,
      endTime: en
    });

    this.programRoleStaffService
      .getStaff(shift.locationId, null)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => {
          this.availableStaff = list || [];
          this.filterStaffList();
          this.showStaffAssignmentModal = true;
        },
        error: () => this.toastService.showError('Failed to load staff.')
      });
  }

  submitRuleStaffModal(): void {
    if (!this.ruleStaffForm?.valid || this.ruleModalShiftId == null || this.ruleModalScheduleId == null || !this.clickedEvent) {
      this.ruleStaffForm?.markAllAsTouched();
      return;
    }
    const v = this.ruleStaffForm.getRawValue();
    const effectiveFrom = schedFormatDate(
      new Date(
        this.clickedEvent.start.getFullYear(),
        this.clickedEvent.start.getMonth(),
        this.clickedEvent.start.getDate()
      )
    );
    const fmt = (t: string) => (t.length === 5 ? t + ':00' : t);
    const req: CreateAssignmentRuleRequest = {
      type: AssignmentRuleType.Direct,
      staffId: v.staffId,
      roleId: null,
      startTime: fmt(v.startTime),
      endTime: fmt(v.endTime),
      effectiveFrom,
      effectiveTo: null,
      notes: null,
      scheduleId: this.ruleModalScheduleId
    };
    this.isAssigningStaff = true;
    this.scheduleService
      .createAssignmentRule(this.ruleModalShiftId, req)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Staff assignment created.');
          this.closeStaffAssignmentModal();
          this.closeEventPopup();
          this.loadCalendarOccurrences();
        },
        error: (e) => {
          console.error(e);
          this.toastService.showError('Failed to create assignment.');
        }
      })
      .add(() => {
        this.isAssigningStaff = false;
      });
  }

  /**
   * Calculates duration between two ISO date strings in hours.
   */
  private calculateDuration(startsAt: string, endsAt: string): number {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  }
}
