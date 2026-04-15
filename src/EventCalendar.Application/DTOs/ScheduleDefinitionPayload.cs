namespace EventCalendar.Application.DTOs;

public class ScheduleDefinitionPayload
{
    public string EvaluatorType { get; set; } = "Rfc5545";
    public string Rrule { get; set; } = string.Empty;
    public string? Rdate { get; set; }
    public string? Exdate { get; set; }
    public string Dtstart { get; set; } = string.Empty;
    public string Timezone { get; set; } = "UTC";
    public int? DurationSeconds { get; set; }
    public bool? IsActive { get; set; }
}
