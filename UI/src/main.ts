import { importProvidersFrom } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { eventCalendarAuthInterceptor } from './app/interceptors/event-calendar-auth.interceptor';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { scheduleReducer } from './app/store/schedule.reducer';
import { LucideAngularModule, UserMinus } from 'lucide-angular';
import { APP_ROUTES } from './app/app.routes';

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(LucideAngularModule.pick({ UserMinus })),
    provideRouter(APP_ROUTES),
    provideHttpClient(withInterceptors([eventCalendarAuthInterceptor])),
    provideStore({
      schedules: scheduleReducer
    }),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: false
    })
  ]
}).catch(err => console.error(err));
