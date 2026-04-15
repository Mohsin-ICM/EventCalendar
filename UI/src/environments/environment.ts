/**
 * Environment configuration for development.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5198',
  eventCalendarApiUrl: 'https://localhost:7101',
  /** Scheduling Kernel Service base URL */
  schedulingKernelUrl: 'http://localhost:5198',
  /** When true, appends a draggable demo shift for local frequency / recurrence testing. */
  includeDemoShifts: true
};

