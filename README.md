# EventCalendarService

Standalone Event Calendar backend service, separated from SchedulingService.

## Architecture

- Owns event metadata and lifecycle.
- Delegates recurrence/split/override/expansion to SchedulingService via HTTP.
- Consumes SchedulingService contract through generated OpenAPI client workflow.

## Projects

- `src/EventCalendar.Api`
- `src/EventCalendar.Application`
- `src/EventCalendar.Domain`
- `src/EventCalendar.Infrastructure`
- `tests/EventCalendar.Tests`
- `UI` (Angular Event Calendar demo app)

## Local Run

```bash
dotnet build EventCalendarService.sln
dotnet run --project src/EventCalendar.Api/EventCalendar.Api.csproj
```

Run UI:

```bash
cd UI
npm install
npm start
```

UI backend target is configured in `UI/src/environments/environment.ts`:

- `eventCalendarApiUrl`: EventCalendar backend base URL (used by Event Calendar demo screens)

## OpenAPI Client Generation

Generate SchedulingService client before release:

```bash
pwsh ./scripts/generate-scheduling-client.ps1
```

The script expects a reachable SchedulingService swagger endpoint.
