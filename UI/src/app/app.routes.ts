import { Routes } from '@angular/router';
import { EventCalendarComponent } from './features/event-calendar/event-calendar.component';
import { CalendarComponent } from './components/calendar/calendar.component';

export const APP_ROUTES: Routes = [
  { path: '', component: EventCalendarComponent },
  { path: 'shift-calendar', component: CalendarComponent },
  { path: '**', redirectTo: '' }
];
