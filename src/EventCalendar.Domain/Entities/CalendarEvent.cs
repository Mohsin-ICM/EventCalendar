namespace EventCalendar.Domain.Entities;

public class CalendarEvent
{
    public Guid Id { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string Color { get; private set; } = "#3b82f6";
    public string Timezone { get; private set; } = "UTC";
    public bool IsActive { get; private set; }
    public bool IsDeleted { get; private set; }
    public ScheduleSyncStatus ScheduleSyncStatus { get; private set; } = ScheduleSyncStatus.InSync;
    public DateTime? LastScheduleSyncAtUtc { get; private set; }
    public string ModuleType { get; private set; } = "Event";
    public string ModuleEntityId { get; private set; } = string.Empty;
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    private CalendarEvent() { }

    public static CalendarEvent Create(
        string title,
        string? description,
        string color,
        string timezone)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title is required.", nameof(title));

        var utcNow = DateTime.UtcNow;
        var id = Guid.NewGuid();

        return new CalendarEvent
        {
            Id = id,
            Title = title.Trim(),
            Description = description?.Trim(),
            Color = string.IsNullOrWhiteSpace(color) ? "#3b82f6" : color.Trim(),
            Timezone = string.IsNullOrWhiteSpace(timezone) ? "UTC" : timezone.Trim(),
            IsActive = true,
            IsDeleted = false,
            ModuleType = "Event",
            ModuleEntityId = id.ToString(),
            CreatedAtUtc = utcNow,
            UpdatedAtUtc = utcNow
        };
    }

    public void UpdateMetadata(
        string title,
        string? description,
        string color,
        string timezone)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title is required.", nameof(title));

        Title = title.Trim();
        Description = description?.Trim();
        Color = string.IsNullOrWhiteSpace(color) ? Color : color.Trim();
        Timezone = string.IsNullOrWhiteSpace(timezone) ? Timezone : timezone.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkDeleted()
    {
        IsDeleted = true;
        IsActive = false;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkScheduleInSync()
    {
        ScheduleSyncStatus = ScheduleSyncStatus.InSync;
        LastScheduleSyncAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkSchedulePendingSync()
    {
        ScheduleSyncStatus = ScheduleSyncStatus.Pending;
        LastScheduleSyncAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
