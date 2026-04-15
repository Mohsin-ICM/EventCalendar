import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgramRoleStaffService, Program, FlattenedProgram } from '../../../services/program-role-staff.service';

@Component({
  selector: 'icm-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './icm-dropdown.component.html',
  styleUrls: ['./icm-dropdown.component.css']
})
export class IcmDropdownComponent implements OnChanges, OnDestroy {
  @Input() items: Array<{ id: number; label: string; disabled?: boolean }> = [];
  @Input() programs: Program[] = [];
  @Input() selectedProgramId: number | null = null;
  @Input() selectedProgramIds: number[] | null = null;
  @Input() placeholder = 'Select Program';
  @Input() disabled = false;
  @Input() invalid = false;
  @Input() multiple = false;
  @Input() includeAllOption = false;
  @Input() valueField: 'programId' | 'currentId' | 'id' = 'programId';

  @Output() selectedProgramIdChange = new EventEmitter<number | null>();
  @Output() selectedProgramIdsChange = new EventEmitter<number[]>();

  flattenedPrograms: Array<FlattenedProgram & { disabled?: boolean }> = [];
  filteredPrograms: Array<FlattenedProgram & { disabled?: boolean }> = [];
  isOpen = false;
  searchTerm = '';
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('triggerButton') triggerButton?: ElementRef<HTMLElement>;
  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  private panelAttachedToBody = false;
  private panelOriginalParent: Node | null = null;
  private panelOriginalNextSibling: Node | null = null;

  constructor(
    private programRoleStaffService: ProgramRoleStaffService,
    private elementRef: ElementRef<HTMLElement>
  ) {}

  ngOnChanges(): void {
    if (this.items && this.items.length > 0) {
      this.flattenedPrograms = this.items.map(item => ({
        id: item.id,
        parentId: 0,
        label: item.label,
        data: {} as any,
        name: item.label,
        children: [],
        level: 1,
        disabled: item.disabled
      }));
    } else {
      this.flattenedPrograms = this.programRoleStaffService.flattenPrograms(this.programs || []);
    }
    this.applyFilter();
  }

  toggleOpen(): void {
    if (this.disabled) return;
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.searchTerm = '';
      this.applyFilter();
      setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
      setTimeout(() => this.attachPanelToBodyAndPosition(), 0);
    } else {
      this.detachPanelFromBody();
    }
  }

  close(): void {
    this.isOpen = false;
    this.detachPanelFromBody();
  }

  selectProgram(programId: number | null): void {
    if (this.disabled) return;
    if (this.multiple) {
      const current = this.getSelectedIds();
      const normalized = typeof programId === 'number' ? programId : null;
      if (normalized === null) {
        this.selectedProgramIdsChange.emit([]);
      } else {
        const next = current.includes(normalized)
          ? current.filter(id => id !== normalized)
          : [...current, normalized];
        this.selectedProgramIdsChange.emit(next);
      }
      return;
    }
    this.selectedProgramIdChange.emit(programId);
    this.close();
  }

  getSelectedLabel(): string {
    if (this.multiple) {
      const selected = this.getSelectedIds();
      if (selected.length === 0) return this.placeholder;
      if (selected.length === 1) {
        const match = this.flattenedPrograms.find(p => this.getProgramValue(p) === selected[0]);
        return match?.label || this.placeholder;
      }
      return `${selected.length} programs selected`;
    }
    if (this.selectedProgramId === null || this.selectedProgramId === undefined) {
      return this.placeholder;
    }
    if (this.includeAllOption && this.selectedProgramId === 0) {
      return 'All';
    }
    const match = this.flattenedPrograms.find(p => this.getProgramValue(p) === this.selectedProgramId);
    return match?.label || this.placeholder;
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.applyFilter();
  }

  getOptionDisabled(program: FlattenedProgram & { disabled?: boolean }): boolean {
    if (this.items && this.items.length > 0) {
      return !!program.disabled;
    }
    const hasChildren = !!(program.children && program.children.length > 0);
    return program.level === 0 || hasChildren;
  }

  getOptionPadding(program: FlattenedProgram): string {
    if (this.items && this.items.length > 0) {
      return '8px';
    }
    const base = program.level === 0 ? 8 : program.level * 20 + 8;
    return `${base}px`;
  }

  isProgramSelected(programId: number | null): boolean {
    if (programId === null || programId === undefined) return false;
    if (this.multiple) {
      return this.getSelectedIds().includes(programId);
    }
    return this.selectedProgramId === programId;
  }

  private applyFilter(): void {
    const term = (this.searchTerm || '').trim().toLowerCase();
    if (!term) {
      this.filteredPrograms = [...this.flattenedPrograms];
      return;
    }
    this.filteredPrograms = this.flattenedPrograms.filter(p =>
      (p.label || '').toLowerCase().includes(term)
    );
  }

  getProgramValue(program: FlattenedProgram): number | null {
    if (!program) return null;
    if (this.valueField === 'currentId') {
      return typeof program.data?.currentId === 'number' ? program.data!.currentId : program.id ?? null;
    }
    if (this.valueField === 'id') {
      return program.id ?? null;
    }
    return typeof program.data?.programId === 'number' ? program.data!.programId : program.id ?? null;
  }

  private getSelectedIds(): number[] {
    if (Array.isArray(this.selectedProgramIds)) {
      return this.selectedProgramIds.filter(id => typeof id === 'number');
    }
    if (typeof this.selectedProgramId === 'number') {
      return [this.selectedProgramId];
    }
    return [];
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(event: MouseEvent): void {
    this.handleOutsideEvent(event.target as Node | null);
  }

  @HostListener('document:touchstart', ['$event'])
  onDocumentTouchStart(event: TouchEvent): void {
    this.handleOutsideEvent(event.target as Node | null);
  }

  private handleOutsideEvent(target: Node | null): void {
    if (!this.isOpen) return;
    if (target && this.elementRef.nativeElement.contains(target)) return;
    const panelEl = this.panel?.nativeElement ?? null;
    if (target && panelEl && panelEl.contains(target)) return;
    this.close();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.positionPanel();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.positionPanel();
  }

  ngOnDestroy(): void {
    this.detachPanelFromBody();
  }

  private attachPanelToBodyAndPosition(): void {
    const panelEl = this.panel?.nativeElement ?? null;
    if (!panelEl || this.panelAttachedToBody) {
      this.positionPanel();
      return;
    }

    this.panelOriginalParent = panelEl.parentNode;
    this.panelOriginalNextSibling = panelEl.nextSibling;

    document.body.appendChild(panelEl);
    this.panelAttachedToBody = true;

    // Ensure it renders above modals and can overflow any scroll containers.
    panelEl.style.position = 'fixed';
    panelEl.style.zIndex = '12000';
    panelEl.style.marginTop = '0';
    panelEl.style.left = '0px';
    panelEl.style.top = '0px';

    this.positionPanel();
  }

  private detachPanelFromBody(): void {
    if (!this.panelAttachedToBody) return;
    const panelEl = this.panel?.nativeElement ?? null;
    if (!panelEl) {
      this.panelAttachedToBody = false;
      this.panelOriginalParent = null;
      this.panelOriginalNextSibling = null;
      return;
    }

    // If Angular already destroyed the panel due to *ngIf, parentNode may be null.
    try {
      if (this.panelOriginalParent) {
        if (this.panelOriginalNextSibling && (this.panelOriginalParent as any).insertBefore) {
          (this.panelOriginalParent as any).insertBefore(panelEl, this.panelOriginalNextSibling);
        } else if ((this.panelOriginalParent as any).appendChild) {
          (this.panelOriginalParent as any).appendChild(panelEl);
        }
      }
    } catch {
      // ignore
    }

    panelEl.style.position = '';
    panelEl.style.zIndex = '';
    panelEl.style.left = '';
    panelEl.style.top = '';
    panelEl.style.width = '';
    panelEl.style.maxWidth = '';

    this.panelAttachedToBody = false;
    this.panelOriginalParent = null;
    this.panelOriginalNextSibling = null;
  }

  private positionPanel(): void {
    if (!this.isOpen) return;
    const panelEl = this.panel?.nativeElement ?? null;
    const triggerEl = this.triggerButton?.nativeElement ?? null;
    if (!panelEl || !triggerEl) return;

    const rect = triggerEl.getBoundingClientRect();
    const gap = 6;
    const viewportW = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;

    const preferredWidth = Math.max(rect.width, 290);
    const maxWidth = Math.max(0, viewportW - 16);
    const width = Math.min(preferredWidth, maxWidth);

    let left = rect.left;
    if (left + width > viewportW - 8) {
      left = Math.max(8, viewportW - width - 8);
    }
    if (left < 8) left = 8;

    // Default: open below; if insufficient space, open above.
    const estimatedHeight = Math.min(panelEl.scrollHeight || 240, 240);
    const spaceBelow = viewportH - rect.bottom;
    const openAbove = spaceBelow < Math.min(estimatedHeight + gap, 180) && rect.top > spaceBelow;
    const top = openAbove ? Math.max(8, rect.top - gap - estimatedHeight) : rect.bottom + gap;

    panelEl.style.left = `${Math.round(left)}px`;
    panelEl.style.top = `${Math.round(top)}px`;
    panelEl.style.width = `${Math.round(width)}px`;
    panelEl.style.maxWidth = `${Math.round(width)}px`;
  }
}
