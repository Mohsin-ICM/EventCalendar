using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EventCalendar.Application.DTOs;
using EventCalendar.Application.Interfaces;
using EventCalendar.Application.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EventCalendar.Infrastructure.Clients;

public class SchedulingKernelHttpClient : ISchedulingKernelClient
{
    private readonly HttpClient _httpClient;
    private readonly SchedulingClientOptions _options;
    private readonly ILogger<SchedulingKernelHttpClient> _logger;
    private readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };

    public SchedulingKernelHttpClient(
        HttpClient httpClient,
        IOptions<SchedulingClientOptions> options,
        ILogger<SchedulingKernelHttpClient> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<ScheduleUpsertResponse> CreateScheduleAsync(
        string moduleType,
        string moduleEntityId,
        ScheduleDefinitionPayload payload,
        CancellationToken cancellationToken)
    {
        var path = $"/v1/schedules/{Uri.EscapeDataString(moduleType)}/{Uri.EscapeDataString(moduleEntityId)}";
        var response = await SendWithRetryAsync(
            () => _httpClient.PostAsJsonAsync(path, payload, cancellationToken),
            cancellationToken);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<ScheduleUpsertResponse>(_jsonOptions, cancellationToken);
        return result ?? new ScheduleUpsertResponse { ModuleType = moduleType, ModuleEntityId = moduleEntityId };
    }

    public async Task<ScheduleDefinitionPayload?> GetScheduleAsync(
        string moduleType,
        string moduleEntityId,
        CancellationToken cancellationToken)
    {
        var path = $"/v1/schedules/{Uri.EscapeDataString(moduleType)}/{Uri.EscapeDataString(moduleEntityId)}";
        var response = await SendWithRetryAsync(() => _httpClient.GetAsync(path, cancellationToken), cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound)
            return null;
        response.EnsureSuccessStatusCode();

        using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

        if (!doc.RootElement.TryGetProperty("lineages", out var lineages) || lineages.GetArrayLength() == 0)
            return null;

        var firstLineage = lineages[0];
        if (!firstLineage.TryGetProperty("segments", out var segments) || segments.GetArrayLength() == 0)
            return null;

        var activeSegment = segments.EnumerateArray()
            .FirstOrDefault(s => s.TryGetProperty("isActive", out var isActive) && isActive.GetBoolean());
        if (activeSegment.ValueKind == JsonValueKind.Undefined)
            activeSegment = segments[0];

        if (!activeSegment.TryGetProperty("definition", out var def))
            return null;

        return def.Deserialize<ScheduleDefinitionPayload>(_jsonOptions);
    }

    public async Task DeleteSchedulesAsync(
        string moduleType,
        string moduleEntityId,
        CancellationToken cancellationToken)
    {
        var path = $"/v1/schedules/{Uri.EscapeDataString(moduleType)}/{Uri.EscapeDataString(moduleEntityId)}";
        var response = await SendWithRetryAsync(() => _httpClient.DeleteAsync(path, cancellationToken), cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound)
            return;
        response.EnsureSuccessStatusCode();
    }

    public async Task<ValidateScheduleResponse> ValidateScheduleAsync(
        ScheduleDefinitionPayload payload,
        CancellationToken cancellationToken)
    {
        var response = await SendWithRetryAsync(
            () => _httpClient.PostAsJsonAsync("/v1/schedules/validate", payload, cancellationToken),
            cancellationToken);

        if (response.IsSuccessStatusCode)
            return new ValidateScheduleResponse { Valid = true };

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        return new ValidateScheduleResponse
        {
            Valid = false,
            Errors = [body]
        };
    }

    public async Task<SchedulingExpandEnvelope> ExpandByReferenceAsync(
        SchedulingExpandByReferenceRequest request,
        CancellationToken cancellationToken)
    {
        var path = $"/v1/schedules/{Uri.EscapeDataString(request.ModuleType)}/{Uri.EscapeDataString(request.ModuleEntityId)}/expand";
        var response = await SendWithRetryAsync(
            () => _httpClient.PostAsJsonAsync(path, request, cancellationToken),
            cancellationToken);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<SchedulingExpandEnvelope>(_jsonOptions, cancellationToken);
        return result ?? new SchedulingExpandEnvelope();
    }

    public async Task UpsertOverrideAsync(
        string moduleType,
        string moduleEntityId,
        int scheduleId,
        UpsertOverrideRequest request,
        CancellationToken cancellationToken)
    {
        var path = $"/v1/schedules/{Uri.EscapeDataString(moduleType)}/{Uri.EscapeDataString(moduleEntityId)}/{scheduleId}/overrides";
        var response = await SendWithRetryAsync(
            () => _httpClient.PostAsJsonAsync(path, request, cancellationToken),
            cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    public async Task SplitScheduleAsync(
        string moduleType,
        string moduleEntityId,
        int scheduleId,
        SplitScheduleRequest request,
        CancellationToken cancellationToken)
    {
        var path = $"/v1/schedules/{Uri.EscapeDataString(moduleType)}/{Uri.EscapeDataString(moduleEntityId)}/{scheduleId}/split";
        var response = await SendWithRetryAsync(
            () => _httpClient.PostAsJsonAsync(path, request, cancellationToken),
            cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    private async Task<HttpResponseMessage> SendWithRetryAsync(
        Func<Task<HttpResponseMessage>> send,
        CancellationToken cancellationToken)
    {
        HttpResponseMessage? response = null;
        Exception? lastException = null;

        for (var attempt = 1; attempt <= Math.Max(1, _options.RetryCount); attempt++)
        {
            using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(Math.Max(1, _options.TimeoutSeconds)));
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);
            try
            {
                response = await send();
                if (response.IsSuccessStatusCode || !IsRetryableStatus(response.StatusCode))
                    return response;
            }
            catch (Exception ex) when (attempt < _options.RetryCount)
            {
                lastException = ex;
                _logger.LogWarning(ex, "Scheduling client attempt {Attempt} failed", attempt);
            }

            if (attempt < _options.RetryCount)
            {
                var jitter = Random.Shared.Next(20, 80);
                var delay = Math.Max(0, _options.RetryDelayMilliseconds) + jitter;
                await Task.Delay(delay, cancellationToken);
            }
        }

        if (response is not null)
            return response;
        throw lastException ?? new InvalidOperationException("Scheduling call failed.");
    }

    private static bool IsRetryableStatus(HttpStatusCode statusCode)
    {
        var code = (int)statusCode;
        return code >= 500 || statusCode == HttpStatusCode.RequestTimeout || statusCode == HttpStatusCode.TooManyRequests;
    }
}
