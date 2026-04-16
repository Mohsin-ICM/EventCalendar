using EventCalendar.Application.DTOs;
using EventCalendar.Application.Interfaces;
using EventCalendar.Application.Options;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ProtoSched = SchedulingService.Grpc.Schedules.V1;

namespace EventCalendar.Infrastructure.Clients;

public class SchedulingKernelGrpcClient : ISchedulingKernelClient
{
    private readonly ProtoSched.SchedulesGrpc.SchedulesGrpcClient _grpcClient;
    private readonly SchedulingClientOptions _options;
    private readonly ILogger<SchedulingKernelGrpcClient> _logger;

    public SchedulingKernelGrpcClient(
        ProtoSched.SchedulesGrpc.SchedulesGrpcClient grpcClient,
        IOptions<SchedulingClientOptions> options,
        ILogger<SchedulingKernelGrpcClient> logger)
    {
        _grpcClient = grpcClient;
        _options = options.Value;
        _logger = logger;
    }

    public Task<ScheduleUpsertResponse> CreateScheduleAsync(
        string moduleType,
        string moduleEntityId,
        ScheduleDefinitionPayload payload,
        CancellationToken cancellationToken) =>
        ExecuteWithRetryAsync(
            async ct =>
            {
                var request = new ProtoSched.CreateScheduleRequest
                {
                    ModuleType = ParseModuleType(moduleType),
                    ModuleEntityId = moduleEntityId,
                    Definition = ToProtoDefinition(payload)
                };
                var response = await _grpcClient.CreateScheduleAsync(request, CallOptions(ct));
                return new ScheduleUpsertResponse
                {
                    ScheduleId = response.ScheduleId,
                    ModuleType = response.ModuleType.ToString(),
                    ModuleEntityId = response.ModuleEntityId
                };
            },
            cancellationToken);

    public Task<ScheduleDefinitionPayload?> GetScheduleAsync(
        string moduleType,
        string moduleEntityId,
        CancellationToken cancellationToken) =>
        ExecuteWithRetryAsync(
            async ct =>
            {
                var request = new ProtoSched.GetSchedulesByEntityRequest
                {
                    ModuleType = ParseModuleType(moduleType),
                    ModuleEntityId = moduleEntityId
                };
                ProtoSched.SchedulesByEntity response;
                try
                {
                    response = await _grpcClient.GetSchedulesByEntityAsync(request, CallOptions(ct));
                }
                catch (RpcException ex) when (ex.StatusCode == StatusCode.NotFound)
                {
                    return (ScheduleDefinitionPayload?)null;
                }

                return ExtractActiveDefinition(response);
            },
            cancellationToken);

    public Task DeleteSchedulesAsync(
        string moduleType,
        string moduleEntityId,
        CancellationToken cancellationToken) =>
        ExecuteWithRetryAsync(
            async ct =>
            {
                var request = new ProtoSched.DiscontinueAllSchedulesRequest
                {
                    ModuleType = ParseModuleType(moduleType),
                    ModuleEntityId = moduleEntityId,
                    DiscontinueAtUtc = ToTimestampUtc(DateTime.UtcNow)
                };
                try
                {
                    await _grpcClient.DiscontinueAllSchedulesAsync(request, CallOptions(ct));
                }
                catch (RpcException ex) when (ex.StatusCode == StatusCode.NotFound)
                {
                    return;
                }
            },
            cancellationToken);

    public Task<ValidateScheduleResponse> ValidateScheduleAsync(
        ScheduleDefinitionPayload payload,
        CancellationToken cancellationToken) =>
        ExecuteWithRetryAsync(
            async ct =>
            {
                var request = new ProtoSched.ValidateScheduleDefinitionRequest
                {
                    Definition = ToProtoDefinition(payload)
                };
                var response = await _grpcClient.ValidateScheduleDefinitionAsync(request, CallOptions(ct));
                if (response.Valid)
                    return new ValidateScheduleResponse { Valid = true };

                return new ValidateScheduleResponse
                {
                    Valid = false,
                    Errors = response.Errors.Select(e => e.Message).ToList()
                };
            },
            cancellationToken);

    public Task<SchedulingExpandEnvelope> ExpandByReferenceAsync(
        SchedulingExpandByReferenceRequest request,
        CancellationToken cancellationToken) =>
        ExecuteWithRetryAsync(
            async ct =>
            {
                var grpcRequest = new ProtoSched.ExpandByReferenceRequest
                {
                    ModuleType = ParseModuleType(request.ModuleType),
                    ModuleEntityId = request.ModuleEntityId,
                    RangeStartUtc = ToTimestampUtc(request.RangeStartUtc),
                    RangeEndUtc = ToTimestampUtc(request.RangeEndUtc)
                };
                if (request.MaxOccurrences is { } maxOcc)
                    grpcRequest.MaxOccurrences = maxOcc;
                if (request.PageSize is { } page)
                    grpcRequest.PageSize = page;
                if (!string.IsNullOrEmpty(request.Cursor))
                    grpcRequest.Cursor = request.Cursor;

                var response = await _grpcClient.ExpandByReferenceAsync(grpcRequest, CallOptions(ct));
                var envelope = new SchedulingExpandEnvelope
                {
                    NextCursor = response.HasNextCursor ? response.NextCursor : null
                };
                foreach (var o in response.Occurrences)
                {
                    envelope.Occurrences.Add(new SchedulingOccurrenceResponse
                    {
                        ScheduleId = o.ScheduleId,
                        ModuleType = o.HasModuleType ? o.ModuleType.ToString() : request.ModuleType,
                        ModuleEntityId = o.HasModuleEntityId ? o.ModuleEntityId : request.ModuleEntityId,
                        StartUtc = o.StartUtc.ToDateTime(),
                        EndUtc = o.EndUtc.ToDateTime()
                    });
                }

                return envelope;
            },
            cancellationToken);

    public Task UpsertOverrideAsync(
        string moduleType,
        string moduleEntityId,
        int scheduleId,
        UpsertOverrideRequest request,
        CancellationToken cancellationToken) =>
        ExecuteWithRetryAsync(
            async ct =>
            {
                var grpcRequest = new ProtoSched.UpsertOccurrenceOverrideRequest
                {
                    ModuleType = ParseModuleType(moduleType),
                    ModuleEntityId = moduleEntityId,
                    ScheduleId = scheduleId,
                    TargetOccurrenceStartUtc = ToTimestampUtc(request.TargetOccurrenceStartUtc),
                    Action = ParseOverrideAction(request.Action)
                };
                if (request.MovedStartUtc is { } ms)
                    grpcRequest.MovedStartUtc = ToTimestampUtc(ms);
                if (request.MovedEndUtc is { } me)
                    grpcRequest.MovedEndUtc = ToTimestampUtc(me);

                await _grpcClient.UpsertOverrideAsync(grpcRequest, CallOptions(ct));
            },
            cancellationToken);

    public Task SplitScheduleAsync(
        string moduleType,
        string moduleEntityId,
        int scheduleId,
        SplitScheduleRequest request,
        CancellationToken cancellationToken) =>
        ExecuteWithRetryAsync(
            async ct =>
            {
                var grpcRequest = new ProtoSched.SplitScheduleRequest
                {
                    ModuleType = ParseModuleType(moduleType),
                    ModuleEntityId = moduleEntityId,
                    ScheduleId = scheduleId,
                    SplitStartUtc = ToTimestampUtc(request.SplitStartUtc),
                    NewDefinition = ToProtoDefinition(request.NewDefinition)
                };
                await _grpcClient.SplitScheduleAsync(grpcRequest, CallOptions(ct));
            },
            cancellationToken);

    private CallOptions CallOptions(CancellationToken cancellationToken)
    {
        var seconds = Math.Max(1, _options.TimeoutSeconds);
        return new CallOptions(
            cancellationToken: cancellationToken,
            deadline: DateTime.UtcNow.AddSeconds(seconds));
    }

    private static Timestamp ToTimestampUtc(DateTime dt)
    {
        var utc = dt.Kind switch
        {
            DateTimeKind.Utc => dt,
            DateTimeKind.Local => dt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc)
        };
        return Timestamp.FromDateTime(utc);
    }

    private static ProtoSched.ScheduleDefinition ToProtoDefinition(ScheduleDefinitionPayload payload)
    {
        var def = new ProtoSched.ScheduleDefinition
        {
            EvaluatorType = ParseEvaluatorType(payload.EvaluatorType),
            Rrule = payload.Rrule,
            DtStartLocal = payload.Dtstart,
            Timezone = payload.Timezone
        };
        if (!string.IsNullOrEmpty(payload.Rdate))
            def.Rdate = payload.Rdate;
        if (!string.IsNullOrEmpty(payload.Exdate))
            def.Exdate = payload.Exdate;
        if (payload.DurationSeconds is { } d)
            def.DurationSeconds = d;
        if (payload.IsActive is { } active)
            def.IsActive = active;
        return def;
    }

    private static ScheduleDefinitionPayload FromProtoDefinition(ProtoSched.ScheduleDefinition def) => new()
    {
        EvaluatorType = def.EvaluatorType.ToString(),
        Rrule = def.Rrule,
        Rdate = def.HasRdate ? def.Rdate : null,
        Exdate = def.HasExdate ? def.Exdate : null,
        Dtstart = def.DtStartLocal,
        Timezone = def.Timezone,
        DurationSeconds = def.DurationSeconds != 0 ? def.DurationSeconds : null,
        IsActive = def.IsActive
    };

    private static ProtoSched.ScheduleEvaluatorType ParseEvaluatorType(string evaluatorType)
    {
        if (string.IsNullOrWhiteSpace(evaluatorType))
            return ProtoSched.ScheduleEvaluatorType.Rfc5545;
        if (System.Enum.TryParse<ProtoSched.ScheduleEvaluatorType>(evaluatorType, ignoreCase: true, out var parsed)
            && parsed != ProtoSched.ScheduleEvaluatorType.Unspecified)
            return parsed;
        throw new ArgumentException($"Unknown evaluator type: {evaluatorType}", nameof(evaluatorType));
    }

    private static ProtoSched.ModuleType ParseModuleType(string moduleType)
    {
        if (string.IsNullOrWhiteSpace(moduleType))
            throw new ArgumentException("Module type is required.", nameof(moduleType));
        if (System.Enum.TryParse<ProtoSched.ModuleType>(moduleType, ignoreCase: true, out var parsed) && System.Enum.IsDefined(parsed))
            return parsed;
        throw new ArgumentException($"Unknown module type: {moduleType}", nameof(moduleType));
    }

    private static ProtoSched.OverrideAction ParseOverrideAction(string action)
    {
        if (string.IsNullOrWhiteSpace(action))
            return ProtoSched.OverrideAction.Unspecified;
        if (System.Enum.TryParse<ProtoSched.OverrideAction>(action, ignoreCase: true, out var parsed) && parsed != ProtoSched.OverrideAction.Unspecified)
            return parsed;
        throw new ArgumentException($"Unknown override action: {action}", nameof(action));
    }

    private static ScheduleDefinitionPayload? ExtractActiveDefinition(ProtoSched.SchedulesByEntity response)
    {
        if (response.Schedules.Count == 0)
            return null;

        foreach (var lineage in response.Schedules)
        {
            foreach (var segment in lineage.Segments)
            {
                if (segment.IsActive && segment.Definition is not null)
                    return FromProtoDefinition(segment.Definition);
            }
        }

        var first = response.Schedules[0].Segments.FirstOrDefault();
        return first?.Definition is { } def ? FromProtoDefinition(def) : null;
    }

    private async Task<T> ExecuteWithRetryAsync<T>(Func<CancellationToken, Task<T>> action, CancellationToken cancellationToken)
    {
        Exception? lastException = null;
        for (var attempt = 1; attempt <= Math.Max(1, _options.RetryCount); attempt++)
        {
            try
            {
                return await action(cancellationToken);
            }
            catch (RpcException ex) when (attempt < _options.RetryCount && IsRetryableRpc(ex))
            {
                lastException = ex;
                _logger.LogWarning(ex, "Scheduling gRPC attempt {Attempt} failed", attempt);
                var jitter = Random.Shared.Next(20, 80);
                var delay = Math.Max(0, _options.RetryDelayMilliseconds) + jitter;
                await Task.Delay(delay, cancellationToken);
            }
            catch (RpcException)
            {
                throw;
            }
        }

        throw lastException ?? new InvalidOperationException("Scheduling gRPC call failed.");
    }

    private async Task ExecuteWithRetryAsync(Func<CancellationToken, Task> action, CancellationToken cancellationToken)
    {
        await ExecuteWithRetryAsync(
            async ct =>
            {
                await action(ct);
                return false;
            },
            cancellationToken);
    }

    private static bool IsRetryableRpc(RpcException ex)
    {
        return ex.StatusCode is StatusCode.Unavailable
            or StatusCode.DeadlineExceeded
            or StatusCode.ResourceExhausted;
    }
}
