namespace EventCalendar.Application.DTOs;

public class CreateEventRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Color { get; set; } = "#3b82f6";
    public string Timezone { get; set; } = "UTC";
    public ScheduleDefinitionPayload? Schedule { get; set; }
}

public class UpdateEventRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Color { get; set; } = "#3b82f6";
    public string Timezone { get; set; } = "UTC";
    public ScheduleDefinitionPayload? Schedule { get; set; }
}

public class EventResponse
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Color { get; set; } = "#3b82f6";
    public string Timezone { get; set; } = "UTC";
    public bool IsActive { get; set; }
    public bool IsDeleted { get; set; }
    public string ModuleType { get; set; } = "Event";
    public string ModuleEntityId { get; set; } = string.Empty;
    public string ScheduleSyncStatus { get; set; } = "InSync";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public ScheduleDefinitionPayload? Schedule { get; set; }
}

public class EventListItemResponse
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Color { get; set; } = "#3b82f6";
    public string Timezone { get; set; } = "UTC";
    public string ScheduleSyncStatus { get; set; } = "InSync";
}
