using EventCalendar.Application.DTOs;
using EventCalendar.Domain.Entities;

namespace EventCalendar.Application.Mapping;

public static class EventMappings
{
    public static EventResponse ToResponse(this CalendarEvent calendarEvent, ScheduleDefinitionPayload? schedule = null)
    {
        return new EventResponse
        {
            Id = calendarEvent.Id,
            Title = calendarEvent.Title,
            Description = calendarEvent.Description,
            Color = calendarEvent.Color,
            Timezone = calendarEvent.Timezone,
            IsActive = calendarEvent.IsActive,
            IsDeleted = calendarEvent.IsDeleted,
            ModuleType = calendarEvent.ModuleType,
            ModuleEntityId = calendarEvent.ModuleEntityId,
            ScheduleSyncStatus = calendarEvent.ScheduleSyncStatus.ToString(),
            CreatedAtUtc = calendarEvent.CreatedAtUtc,
            UpdatedAtUtc = calendarEvent.UpdatedAtUtc,
            Schedule = schedule
        };
    }

    public static EventListItemResponse ToListItem(this CalendarEvent calendarEvent)
    {
        return new EventListItemResponse
        {
            Id = calendarEvent.Id,
            Title = calendarEvent.Title,
            Color = calendarEvent.Color,
            Timezone = calendarEvent.Timezone,
            ScheduleSyncStatus = calendarEvent.ScheduleSyncStatus.ToString()
        };
    }
}
