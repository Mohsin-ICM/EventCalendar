# EventCalendar API Reference

Base route: `/v1/events`

## Create Event

`POST /v1/events`

```json
{
  "title": "Team Standup",
  "description": "Daily team sync",
  "color": "#3b82f6",
  "timezone": "America/New_York",
  "schedule": {
    "evaluatorType": "Rfc5545",
    "rrule": "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    "dtstart": "2026-04-06T09:00:00",
    "timezone": "America/New_York",
    "durationSeconds": 1800
  }
}
```

Returns created event with schedule sync status.

## Update Event

`PUT /v1/events/{eventId}`

Same payload as create.

## Get Event

`GET /v1/events/{eventId}`

Returns event metadata plus current schedule snapshot (if available).

## List Events

`GET /v1/events`

Returns active event summaries.

## Delete Event

`DELETE /v1/events/{eventId}`

Soft-deletes event and delegates schedule deletion to SchedulingService.

## Validate Schedule

`POST /v1/events/validate-schedule`

```json
{
  "schedule": {
    "evaluatorType": "Rfc5545",
    "rrule": "FREQ=DAILY;COUNT=10",
    "dtstart": "2026-04-06T09:00:00",
    "timezone": "UTC",
    "durationSeconds": 3600
  }
}
```

## Expand Occurrences

`POST /v1/events/{eventId}/occurrences/expand`

```json
{
  "rangeStartUtc": "2026-04-01T00:00:00Z",
  "rangeEndUtc": "2026-04-30T23:59:59Z",
  "maxOccurrences": 500,
  "pageSize": 100,
  "cursor": null
}
```

Returns event-enriched occurrence rows.

## Override Occurrence

`POST /v1/events/{eventId}/occurrences/overrides`

Skip:

```json
{
  "targetOccurrenceStartUtc": "2026-04-10T13:00:00Z",
  "action": "Skip"
}
```

Move:

```json
{
  "targetOccurrenceStartUtc": "2026-04-10T13:00:00Z",
  "action": "Move",
  "movedStartUtc": "2026-04-11T13:00:00Z",
  "movedEndUtc": "2026-04-11T14:00:00Z"
}
```

## Split Schedule

`POST /v1/events/{eventId}/schedule/split`

```json
{
  "splitStartUtc": "2026-05-01T00:00:00Z",
  "newDefinition": {
    "evaluatorType": "Rfc5545",
    "rrule": "FREQ=WEEKLY;BYDAY=TU,TH",
    "dtstart": "2026-05-01T09:00:00",
    "timezone": "UTC",
    "durationSeconds": 3600
  }
}
```
