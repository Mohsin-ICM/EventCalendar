import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import {
  EVENT_CALENDAR_TOKEN_STORAGE_KEY,
  getEventCalendarBearerToken
} from '../interceptors/event-calendar-auth.interceptor';

@Component({
  selector: 'app-event-calendar-token-panel',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="wrap">
      <button type="button" class="toggle" (click)="open.set(!open())">
        Event Calendar API token
      </button>
      @if (open()) {
        <div class="panel" role="dialog" aria-label="Bearer token for Event Calendar API">
          <p class="hint">
            Paste a JWT for requests to <code>{{ apiBase }}</code>. Stored in session only (this browser tab).
          </p>
          <textarea
            rows="3"
            class="input"
            placeholder="eyJhbGciOiJIUzI1NiIs..."
            [(ngModel)]="tokenDraft"
            autocomplete="off"
            spellcheck="false"
          ></textarea>
          <div class="actions">
            <button type="button" class="btn primary" (click)="save()">Save</button>
            <button type="button" class="btn" (click)="clear()">Clear</button>
          </div>
          @if (status()) {
            <p class="status">{{ status() }}</p>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .wrap {
        position: fixed;
        bottom: 12px;
        right: 12px;
        z-index: 9999;
        font-size: 13px;
        max-width: min(420px, calc(100vw - 24px));
      }
      .toggle {
        float: right;
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid #ccc;
        background: #fff;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
        cursor: pointer;
      }
      .toggle:hover {
        background: #f8f8f8;
      }
      .panel {
        clear: both;
        margin-top: 8px;
        padding: 12px;
        border-radius: 8px;
        border: 1px solid #ccc;
        background: #fff;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      }
      .hint {
        margin: 0 0 8px;
        color: #444;
        line-height: 1.4;
      }
      .hint code {
        font-size: 11px;
        word-break: break-all;
      }
      .input {
        width: 100%;
        font-family: ui-monospace, monospace;
        font-size: 12px;
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 6px;
        resize: vertical;
      }
      .actions {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }
      .btn {
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid #ccc;
        background: #fff;
        cursor: pointer;
      }
      .btn.primary {
        background: #222;
        color: #fff;
        border-color: #222;
      }
      .status {
        margin: 8px 0 0;
        color: #0a0;
        font-size: 12px;
      }
    `
  ]
})
export class EventCalendarTokenPanelComponent {
  readonly apiBase = environment.eventCalendarApiUrl;
  readonly open = signal(false);
  readonly status = signal('');

  tokenDraft = '';

  constructor() {
    const current = getEventCalendarBearerToken();
    this.tokenDraft = current ?? '';
  }

  save(): void {
    const v = this.tokenDraft.trim();
    if (v) {
      sessionStorage.setItem(EVENT_CALENDAR_TOKEN_STORAGE_KEY, v);
      this.status.set('Saved. Requests to the Event Calendar API will include Authorization.');
    } else {
      sessionStorage.removeItem(EVENT_CALENDAR_TOKEN_STORAGE_KEY);
      this.status.set('Cleared.');
    }
    setTimeout(() => this.status.set(''), 4000);
  }

  clear(): void {
    this.tokenDraft = '';
    sessionStorage.removeItem(EVENT_CALENDAR_TOKEN_STORAGE_KEY);
    this.status.set('Token removed from this session.');
    setTimeout(() => this.status.set(''), 4000);
  }
}
