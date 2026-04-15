namespace EventCalendar.Application.DTOs;

public class ScheduleUpsertResponse
{
    public int ScheduleId { get; set; }
    public string ModuleType { get; set; } = string.Empty;
    public string ModuleEntityId { get; set; } = string.Empty;
}

public class SchedulingOccurrenceResponse
{
    public int ScheduleId { get; set; }
    public string ModuleType { get; set; } = string.Empty;
    public string ModuleEntityId { get; set; } = string.Empty;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
}

public class SchedulingExpandEnvelope
{
    public List<SchedulingOccurrenceResponse> Occurrences { get; set; } = [];
    public string? NextCursor { get; set; }
}

public class SchedulingExpandByReferenceRequest
{
    public string ModuleType { get; set; } = "Event";
    public string ModuleEntityId { get; set; } = string.Empty;
    public DateTime RangeStartUtc { get; set; }
    public DateTime RangeEndUtc { get; set; }
    public int? MaxOccurrences { get; set; }
    public int? PageSize { get; set; }
    public string? Cursor { get; set; }
}
