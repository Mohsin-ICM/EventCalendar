import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ModalStateService {
  private readonly modalCount$ = new BehaviorSubject<number>(0);
  private readonly isBrowser: boolean;
  private previousBodyOverflow: string | null = null;
  private previousBodyPaddingRight: string | null = null;
  private previousBodyTouchAction: string | null = null;
  private scrollLockApplied = false;

  get openCount$() {
    return this.modalCount$.asObservable();
  }

  get openCount(): number {
    return this.modalCount$.value;
  }

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  open(): void {
    const prev = this.modalCount$.value;
    const next = prev + 1;
    this.modalCount$.next(next);
    if (prev === 0 && next === 1) {
      this.lockScroll();
    }
  }

  close(): void {
    const prev = this.modalCount$.value;
    const next = Math.max(0, prev - 1);
    this.modalCount$.next(next);
    if (prev > 0 && next === 0) {
      this.unlockScroll();
    }
  }

  reset(): void {
    this.modalCount$.next(0);
    this.unlockScroll();
  }

  private lockScroll(): void {
    if (!this.isBrowser) return;
    if (this.scrollLockApplied) return;

    const body = this.document.body;
    const docEl = this.document.documentElement;
    if (!body || !docEl) return;

    // Store previous inline styles so we can restore exactly.
    this.previousBodyOverflow = body.style.overflow || null;
    this.previousBodyPaddingRight = body.style.paddingRight || null;
    this.previousBodyTouchAction = body.style.touchAction || null;

    // Prevent background scroll while any modal is open.
    body.classList.add('icm-modal-open');
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';

    // Avoid layout shift when removing the scrollbar.
    const scrollbarWidth = window.innerWidth - docEl.clientWidth;
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    this.scrollLockApplied = true;
  }

  private unlockScroll(): void {
    if (!this.isBrowser) return;
    if (!this.scrollLockApplied) return;

    const body = this.document.body;
    if (!body) return;

    body.classList.remove('icm-modal-open');

    body.style.overflow = this.previousBodyOverflow ?? '';
    body.style.paddingRight = this.previousBodyPaddingRight ?? '';
    body.style.touchAction = this.previousBodyTouchAction ?? '';

    this.previousBodyOverflow = null;
    this.previousBodyPaddingRight = null;
    this.previousBodyTouchAction = null;
    this.scrollLockApplied = false;
  }
}
