# Custom Calendar Component

A reusable Angular calendar component extracted from the StaffScheduler frontend project. This component displays schedules in monthly, weekly, and daily views with filtering capabilities.

## Features

- **Multiple View Types**: Monthly, Weekly, and Daily calendar views
- **Filtering**: Filter by Program, Role, Staff, and schedule status
- **Event Display**: Shows schedule events with color coding based on staffing status
- **Event Details**: Click events to view detailed information
- **Staff Assignment**: Assign or remove staff from schedule instances
- **Real-time Updates**: Optional SignalR integration for real-time schedule updates

## Installation

### Peer Dependencies

This component requires the following Angular packages (peer dependencies):

```json
{
  "@angular/core": "^18.0.0",
  "@angular/common": "^18.0.0",
  "@angular/forms": "^18.0.0",
  "@angular/router": "^18.0.0",
  "@ngrx/store": "^18.0.0",
  "@microsoft/signalr": "^8.0.0",
  "rxjs": "~7.8.0",
  "bootstrap": "^5.3.3"
}
```

### Required Environment Variables

Create an `environment.ts` file in `src/environments/` with your API configuration:

```typescript
export const environment = {
  production: false,
  apiUrl: 'https://your-api-url.com'
};
```

## Usage

### 1. Import the Component

```typescript
import { CalendarComponent } from './components/calendar/calendar.component';

@Component({
  selector: 'app-my-component',
  standalone: true,
  imports: [CalendarComponent],
  template: '<app-calendar></app-calendar>'
})
export class MyComponent {}
```

### 2. Provide Required Services

The component uses the following services (all provided in 'root' by default):

- `ScheduleService` - Handles API calls for schedules, instances, and assignment rules
- `ProgramRoleStaffService` - Manages programs, roles, and staff data
- `ToastService` - Displays toast notifications
- `SignalRService` - Optional real-time updates (gracefully handles connection failures)

### 3. Optional: NgRx Store Setup

The component can work with or without NgRx store. If you want to use the store:

```typescript
import { StoreModule } from '@ngrx/store';
import { scheduleReducer } from './store/schedule.reducer';

@NgModule({
  imports: [
    StoreModule.forFeature('schedules', scheduleReducer)
  ]
})
export class AppModule {}
```

If the store is not available, the component will automatically load shifts directly from the service.

### 4. Required API Endpoints

The component expects the following API endpoints:

- `GET /api/v1/shifts/all` - Get all shifts
- `GET /api/v1/schedules?from={date}&to={date}` - Get schedules in date range
- `GET /api/v1/instances?start={iso}&end={iso}` - Get instances in date range
- `GET /api/v1/shifts/{shiftId}/rules` - Get assignment rules for a shift
- `GET /api/v1/schedules?shiftId={shiftId}` - Get schedules for a shift
- `POST /api/v1/instances/{id}/assignees` - Add assignees to instance
- `DELETE /api/v1/instances/{id}/assignees` - Remove assignees from instance
- `GET /api/v1/shifts/{shiftId}/rules/effective?date={date}` - Get effective rules
- `GET /api/v1/shifts/{shiftId}/assignees?date={date}` - Get resolved assignees

External API endpoints (for programs, roles, staff):
- `GET /api/user/get-assigned-oh/{userId}` - Get programs
- `GET /api/user/roles` - Get roles
- `POST /api/staff-scheduler/shift/get-staffs` - Get staff

## Component Structure

```
customCalendar/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   └── calendar/
│   │   │       ├── calendar.component.ts
│   │   │       ├── calendar.component.html
│   │   │       └── calendar.component.scss
│   │   ├── models/
│   │   │   └── schedule.models.ts
│   │   ├── services/
│   │   │   ├── schedule.service.ts
│   │   │   ├── program-role-staff.service.ts
│   │   │   ├── toast.service.ts
│   │   │   └── signalr.service.ts
│   │   └── store/
│   │       ├── schedule.actions.ts
│   │       ├── schedule.reducer.ts
│   │       └── schedule.selectors.ts
│   └── environments/
│       └── environment.ts
└── README.md
```

## Styling

The component uses:
- **Bootstrap 5** for base styling
- **Tailwind CSS** classes (if available in your project)
- Custom SCSS for calendar-specific styles

Make sure Bootstrap CSS is included in your application:

```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
```

For Bootstrap Icons:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
```

## API Configuration

The component requires:

1. **Backend API**: Configured via `environment.apiUrl`
2. **External API**: For programs/roles/staff (hardcoded to `https://qa-api.icm.care/api` in `ProgramRoleStaffService`)

To customize the external API URL, modify `program-role-staff.service.ts`:

```typescript
private readonly baseUrl = 'https://your-api-url.com/api';
```

## Notes

- The component is **standalone** and can be imported directly
- **Router is optional** - the component works without routing
- **NgRx Store is optional** - falls back to direct service calls if unavailable
- **SignalR is optional** - connection failures are handled gracefully
- The component loads shifts on initialization
- All services are provided in 'root' by default

## Troubleshooting

### Component not displaying

- Check that all required services are provided
- Verify API endpoints are accessible
- Check browser console for errors

### Shifts not loading

- If using NgRx store, ensure the store is properly configured
- If not using store, verify `getAllShifts()` API endpoint is working
- Check network tab for API call failures

### Styling issues

- Ensure Bootstrap CSS is loaded
- Check that Bootstrap Icons are available
- Verify Tailwind CSS classes are available (or remove them if not using Tailwind)

