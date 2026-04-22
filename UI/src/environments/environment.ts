/**
 * Environment configuration for development.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5198',
  eventCalendarApiUrl: 'https://localhost:7101',
  /** Optional default JWT for Event Calendar API (dev). Prefer the in-app "Event Calendar API token" panel or sessionStorage. */
  eventCalendarBearerToken: '' as string,
  /** Scheduling Kernel Service base URL */
  schedulingKernelUrl: 'http://localhost:5198',
  /** When true, appends a draggable demo shift for local frequency / recurrence testing. */
  includeDemoShifts: true
};

