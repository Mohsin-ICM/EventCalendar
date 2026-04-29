namespace EventCalendar.Application.Options;

public class SchedulingClientOptions
{
    public const string SectionName = "SchedulingKernel";

    /// <summary>Base URL for REST (legacy); also used as gRPC address when <see cref="GrpcUrl"/> is not set.</summary>
    public string BaseUrl { get; set; } = "http://localhost:5198/";

    /// <summary>
    /// gRPC base URL (must use HTTP/2). For local Kestrel, use the HTTPS URL (e.g. https://localhost:7289), not plain http://
    /// on port 5198 — that endpoint is typically HTTP/1.1-only and gRPC will fail with HTTP_1_1_REQUIRED.
    /// When null or empty, <see cref="BaseUrl"/> is used.
    /// </summary>
    public string? GrpcUrl { get; set; } = "https://scheduling-service-api.livelybeach-de2d2a5b.centralus.azurecontainerapps.io/";
    public int RetryCount { get; set; } = 3;
    public int RetryDelayMilliseconds { get; set; } = 200;
    public int TimeoutSeconds { get; set; } = 10;
}
