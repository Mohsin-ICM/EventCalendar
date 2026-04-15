namespace EventCalendar.Application.DTOs;

public class ExpandOccurrencesRequest
{
    public DateTime RangeStartUtc { get; set; }
    public DateTime RangeEndUtc { get; set; }
    public int? MaxOccurrences { get; set; }
    public int? PageSize { get; set; }
    public string? Cursor { get; set; }
}

public class OccurrenceResponse
{
    public Guid EventId { get; set; }
    public string EventTitle { get; set; } = string.Empty;
    public string EventColor { get; set; } = "#3b82f6";
    public string ModuleType { get; set; } = "Event";
    public string ModuleEntityId { get; set; } = string.Empty;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
}

public class ExpandedOccurrencesEnvelope
{
    public List<OccurrenceResponse> Occurrences { get; set; } = [];
    public string? NextCursor { get; set; }
}

public class UpsertOverrideRequest
{
    public DateTime TargetOccurrenceStartUtc { get; set; }
    public string Action { get; set; } = "Skip";
    public DateTime? MovedStartUtc { get; set; }
    public DateTime? MovedEndUtc { get; set; }
}

public class SplitScheduleRequest
{
    public DateTime SplitStartUtc { get; set; }
    public ScheduleDefinitionPayload NewDefinition { get; set; } = new();
}

public class ValidateScheduleRequest
{
    public ScheduleDefinitionPayload Schedule { get; set; } = new();
}

public class ValidateScheduleResponse
{
    public bool Valid { get; set; }
    public List<string> Errors { get; set; } = [];
}
