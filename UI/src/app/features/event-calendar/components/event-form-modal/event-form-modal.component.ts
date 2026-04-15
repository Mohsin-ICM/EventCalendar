import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { RRule } from 'rrule';
import { ScheduleDefinitionComponent } from '../../../../scheduling/components/schedule-definition/schedule-definition.component';
import { ScheduleDefinitionPayload } from '../../../../scheduling/models/scheduling.models';
import { ModalStateService } from '../../../../core/services/modal-state.service';
import {
  EventFormModalData,
  EventFormResult,
  EVENT_COLOR_PALETTE
} from '../../models/event-calendar.models';

function toRRuleDtstart(dtstart: string): string {
  const d = new Date(dtstart + 'Z');
  const pad = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

function formatPreviewOccurrence(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  }).format(new Date(Date.UTC(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes()
  )));
}

@Component({
  selector: 'app-event-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ScheduleDefinitionComponent],
  templateUrl: './event-form-modal.component.html'
})
export class EventFormModalComponent implements OnInit, OnDestroy {
  @Input() data: EventFormModalData | null = null;
  @Output() save = new EventEmitter<EventFormResult>();
  @Output() cancel = new EventEmitter<void>();

  readonly titleControl = new FormControl('', [Validators.required, Validators.minLength(1)]);
  readonly colorControl = new FormControl(EVENT_COLOR_PALETTE[0]);
  readonly isSaving = signal(false);
  readonly isDefinitionValid = signal(false);
  readonly currentDefinition = signal<ScheduleDefinitionPayload | null>(null);
  readonly previewOccurrences = signal<Date[]>([]);
  readonly colorPalette = EVENT_COLOR_PALETTE;

  // Stable reference — computed once in ngOnInit so Angular's change detection
  // doesn't see a new object on every CD cycle and endlessly reset the child form.
  initialDefinition: ScheduleDefinitionPayload | null = null;

  get isEditMode(): boolean {
    return this.data?.mode === 'edit';
  }

  get modalTitle(): string {
    return this.isEditMode ? 'Edit Event' : 'Create Event';
  }

  constructor(private modalState: ModalStateService) {}

  ngOnInit(): void {
    this.modalState.open();
    this.initialDefinition = this.buildInitialDefinition();
    if (this.data?.event) {
      this.titleControl.setValue(this.data.event.title);
      this.colorControl.setValue(this.data.event.color);
    }
  }

  private buildInitialDefinition(): ScheduleDefinitionPayload | null {
    if (this.data?.schedule) return this.data.schedule;
    if (this.data?.initialDate) {
      const d = this.data.initialDate;
      const pad = (n: number) => String(n).padStart(2, '0');
      return {
        evaluatorType: 'Rfc5545',
        rrule: 'FREQ=DAILY;COUNT=1',
        dtstart: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00:00`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        durationSeconds: 3600
      };
    }
    return null;
  }

  ngOnDestroy(): void {
    this.modalState.close();
  }

  onDefinitionChange(payload: ScheduleDefinitionPayload): void {
    this.currentDefinition.set(payload);
    this.refreshPreview(payload);
  }

  onValidChange(valid: boolean): void {
    this.isDefinitionValid.set(valid);
  }

  onSave(): void {
    this.titleControl.markAsTouched();
    if (this.titleControl.invalid || !this.currentDefinition()) return;

    this.save.emit({
      title: this.titleControl.value!.trim(),
      color: this.colorControl.value ?? EVENT_COLOR_PALETTE[0],
      definition: this.currentDefinition()!,
      eventId: this.data?.event?.id
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }

  private refreshPreview(payload: ScheduleDefinitionPayload): void {
    try {
      const dtstartCompact = toRRuleDtstart(payload.dtstart);
      const fullStr = `DTSTART:${dtstartCompact}\nRRULE:${payload.rrule}`;
      const rule = RRule.fromString(fullStr);
      const all = rule.all((_, i) => i < 8);
      this.previewOccurrences.set(all);
    } catch {
      this.previewOccurrences.set([]);
    }
  }

  formatOcc(d: Date): string {
    return formatPreviewOccurrence(d);
  }
}
