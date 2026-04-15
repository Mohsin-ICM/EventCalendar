namespace EventCalendar.Application.Options;

public class SchedulingClientOptions
{
    public const string SectionName = "SchedulingKernel";

    public string BaseUrl { get; set; } = "https://scheduling-service-api.livelybeach-de2d2a5b.centralus.azurecontainerapps.io/";
    public int RetryCount { get; set; } = 3;
    public int RetryDelayMilliseconds { get; set; } = 200;
    public int TimeoutSeconds { get; set; } = 10;
}
