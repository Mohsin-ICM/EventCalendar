import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Reusable weekday pill-button selector.
 * Uses JS weekday indices: 0 = Sunday … 6 = Saturday.
 * Emits a sorted copy of the selected indices on every toggle.
 */
@Component({
  selector: 'app-weekday-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weekday-picker.component.html'
})
export class WeekdayPickerComponent {
  readonly labels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  @Input() selectedDays: number[] = [];
  @Output() selectedDaysChange = new EventEmitter<number[]>();

  toggle(i: number): void {
    const next = this.selectedDays.includes(i)
      ? this.selectedDays.filter(d => d !== i)
      : [...this.selectedDays, i].sort((a, b) => a - b);
    this.selectedDaysChange.emit(next);
  }

  isSelected(i: number): boolean {
    return this.selectedDays.includes(i);
  }
}
