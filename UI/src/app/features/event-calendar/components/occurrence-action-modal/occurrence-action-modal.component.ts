import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ScheduleDefinitionComponent } from '../../../../scheduling/components/schedule-definition/schedule-definition.component';
import { ScheduleDefinitionPayload } from '../../../../scheduling/models/scheduling.models';
import {
  OccurrenceAction,
  OccurrenceActionModalData
} from '../../models/event-calendar.models';
import { ModalStateService } from '../../../../core/services/modal-state.service';

type ActionMode = 'none' | 'move' | 'split' | 'edit-all';

function formatDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

@Component({
  selector: 'app-occurrence-action-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ScheduleDefinitionComponent],
  templateUrl: './occurrence-action-modal.component.html'
})
export class OccurrenceActionModalComponent implements OnInit, OnDestroy {
  @Input() data: OccurrenceActionModalData | null = null;
  @Output() action = new EventEmitter<OccurrenceAction>();
  @Output() cancel = new EventEmitter<void>();

  readonly mode = signal<ActionMode>('none');
  readonly workingDefinition = signal<ScheduleDefinitionPayload | null>(null);

  readonly moveStartControl = new FormControl<string>('');
  readonly moveEndControl = new FormControl<string>('');

  constructor(private modalState: ModalStateService) {}

  ngOnInit(): void {
    this.modalState.open();
    const occ = this.data?.occurrence;
    if (occ) {
      this.moveStartControl.setValue(formatDateTimeLocal(occ.startsAt));
      this.moveEndControl.setValue(formatDateTimeLocal(occ.endsAt));
    }
  }

  ngOnDestroy(): void {
    this.modalState.close();
  }

  setMode(mode: ActionMode): void {
    this.mode.set(mode);
    if ((mode === 'split' || mode === 'edit-all') && this.data?.currentSchedule) {
      this.workingDefinition.set(this.data.currentSchedule);
    }
  }

  onDefinitionChange(payload: ScheduleDefinitionPayload): void {
    this.workingDefinition.set(payload);
  }

  skip(): void {
    this.action.emit({ type: 'skip' });
  }

  move(): void {
    const startRaw = this.moveStartControl.value;
    const endRaw = this.moveEndControl.value;
    if (!startRaw || !endRaw) return;

    const newStart = new Date(startRaw);
    const newEnd = new Date(endRaw);
    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime()) || newEnd <= newStart) return;

    this.action.emit({
      type: 'move',
      newStartsAt: newStart,
      newEndsAt: newEnd
    });
  }

  split(): void {
    const def = this.workingDefinition();
    if (!def || !this.data?.occurrence) return;
    this.action.emit({
      type: 'split',
      fromDate: this.data.occurrence.startsAt,
      newDefinition: def
    });
  }

  editAll(): void {
    const def = this.workingDefinition();
    if (!def) return;
    this.action.emit({
      type: 'edit-all',
      newDefinition: def
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
