using EventCalendar.Application.DTOs;
using EventCalendar.Application.Interfaces;

namespace EventCalendar.Tests.Initializers;

internal class FakeSchedulingKernelClient : ISchedulingKernelClient
{
    public bool ThrowOnCreate { get; set; }
    public List<SchedulingOccurrenceResponse> Occurrences { get; } = [];

    public Task<ScheduleUpsertResponse> CreateScheduleAsync(string moduleType, string moduleEntityId, ScheduleDefinitionPayload payload, CancellationToken cancellationToken)
    {
        if (ThrowOnCreate)
            throw new InvalidOperationException("Simulated scheduling failure.");

        return Task.FromResult(new ScheduleUpsertResponse
        {
            ScheduleId = 101,
            ModuleType = moduleType,
            ModuleEntityId = moduleEntityId
        });
    }

    public Task<ScheduleDefinitionPayload?> GetScheduleAsync(string moduleType, string moduleEntityId, CancellationToken cancellationToken)
    {
        return Task.FromResult<ScheduleDefinitionPayload?>(new ScheduleDefinitionPayload
        {
            EvaluatorType = "Rfc5545",
            Rrule = "FREQ=DAILY;COUNT=1",
            Dtstart = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss"),
            Timezone = "UTC",
            DurationSeconds = 3600
        });
    }

    public Task DeleteSchedulesAsync(string moduleType, string moduleEntityId, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    public Task<ValidateScheduleResponse> ValidateScheduleAsync(ScheduleDefinitionPayload payload, CancellationToken cancellationToken)
    {
        return Task.FromResult(new ValidateScheduleResponse { Valid = true });
    }

    public Task<SchedulingExpandEnvelope> ExpandByReferenceAsync(SchedulingExpandByReferenceRequest request, CancellationToken cancellationToken)
    {
        return Task.FromResult(new SchedulingExpandEnvelope
        {
            Occurrences = Occurrences.ToList()
        });
    }

    public Task UpsertOverrideAsync(string moduleType, string moduleEntityId, int scheduleId, UpsertOverrideRequest request, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    public Task SplitScheduleAsync(string moduleType, string moduleEntityId, int scheduleId, SplitScheduleRequest request, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}
