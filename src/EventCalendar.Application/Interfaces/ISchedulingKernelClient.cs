using EventCalendar.Application.DTOs;

namespace EventCalendar.Application.Interfaces;

public interface ISchedulingKernelClient
{
    Task<ScheduleUpsertResponse> CreateScheduleAsync(
        string moduleType,
        string moduleEntityId,
        ScheduleDefinitionPayload payload,
        CancellationToken cancellationToken);

    Task<ScheduleDefinitionPayload?> GetScheduleAsync(
        string moduleType,
        string moduleEntityId,
        CancellationToken cancellationToken);

    Task DeleteSchedulesAsync(
        string moduleType,
        string moduleEntityId,
        CancellationToken cancellationToken);

    Task<ValidateScheduleResponse> ValidateScheduleAsync(
        ScheduleDefinitionPayload payload,
        CancellationToken cancellationToken);

    Task<SchedulingExpandEnvelope> ExpandByReferenceAsync(
        SchedulingExpandByReferenceRequest request,
        CancellationToken cancellationToken);

    Task UpsertOverrideAsync(
        string moduleType,
        string moduleEntityId,
        int scheduleId,
        UpsertOverrideRequest request,
        CancellationToken cancellationToken);

    Task SplitScheduleAsync(
        string moduleType,
        string moduleEntityId,
        int scheduleId,
        SplitScheduleRequest request,
        CancellationToken cancellationToken);
}
