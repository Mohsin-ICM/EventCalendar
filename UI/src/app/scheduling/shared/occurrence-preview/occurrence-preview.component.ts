import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RRule } from 'rrule';
import { toRRuleDtstart, toISOLocal, formatOccurrenceDate } from '../../utils/rrule-utils';

export interface PreviewOccurrence {
  isoLocal: string;
  label: string;
  excluded: boolean;
}

/**
 * Reusable occurrence preview list.
 * Expands occurrences from an RRULE string using rrule.js — no custom recurrence math.
 * Emits ISO-local strings for the parent to manage as exdates.
 */
@Component({
  selector: 'app-occurrence-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './occurrence-preview.component.html'
})
export class OccurrencePreviewComponent implements OnChanges {
  /** RRULE string without the "RRULE:" prefix, e.g. "FREQ=WEEKLY;BYDAY=MO,TH" */
  @Input() rruleString: string = '';
  /** ISO local dtstart, e.g. "2026-04-08T09:00:00" */
  @Input() dtstart: string = '';
  /** Number of non-excluded occurrences to display */
  @Input() count: number = 10;
  /** ISO local strings of excluded occurrences */
  @Input() exdates: string[] = [];

  /** Emits the ISO local string of the toggled occurrence */
  @Output() toggleExdate = new EventEmitter<string>();

  occurrences: PreviewOccurrence[] = [];

  ngOnChanges(_changes: SimpleChanges): void {
    this.refresh();
  }

  toggle(iso: string): void {
    this.toggleExdate.emit(iso);
  }

  private refresh(): void {
    if (!this.rruleString || !this.dtstart) {
      this.occurrences = [];
      return;
    }
    try {
      const fullStr = `DTSTART:${toRRuleDtstart(this.dtstart)}\nRRULE:${this.rruleString}`;
      const rule = RRule.fromString(fullStr);
      const exSet = new Set(this.exdates);
      // Over-fetch so excluded ones can still be shown (user can un-exclude them)
      const fetchCount = this.count + exSet.size + 5;
      const all = rule.all((_, i) => i < fetchCount);
      this.occurrences = all.slice(0, this.count + exSet.size).map(d => {
        const iso = toISOLocal(d);
        return { isoLocal: iso, label: formatOccurrenceDate(d), excluded: exSet.has(iso) };
      });
    } catch {
      this.occurrences = [];
    }
  }
}
