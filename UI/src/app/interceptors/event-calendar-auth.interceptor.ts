import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const EVENT_CALENDAR_TOKEN_STORAGE_KEY = 'eventCalendarBearerToken';

/** Token from the dev panel (sessionStorage) or optional `environment.eventCalendarBearerToken`. */
export function getEventCalendarBearerToken(): string | null {
  const fromStorage =
    typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem(EVENT_CALENDAR_TOKEN_STORAGE_KEY)?.trim()
      : null;
  if (fromStorage) return fromStorage;
  const fromEnv = environment.eventCalendarBearerToken?.trim();
  return fromEnv || null;
}

export const eventCalendarAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const base = environment.eventCalendarApiUrl.replace(/\/$/, '');
  const url = req.url.split('?')[0];
  if (!url.startsWith(base)) {
    return next(req);
  }

  const raw = getEventCalendarBearerToken();
  if (!raw) {
    return next(req);
  }

  const value = raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
  return next(req.clone({ setHeaders: { Authorization: value } }));
};
