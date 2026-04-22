import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { EventCalendarTokenPanelComponent } from './dev/event-calendar-token-panel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, EventCalendarTokenPanelComponent],
  template: `
    @if (!environment.production) {
      <app-event-calendar-token-panel />
    }
    <router-outlet />
  `
})
export class AppComponent {
  readonly environment = environment;
}
