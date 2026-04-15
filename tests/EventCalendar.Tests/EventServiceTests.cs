using EventCalendar.Application.DTOs;
using EventCalendar.Application.Interfaces;
using EventCalendar.Tests.Initializers;
using Microsoft.Extensions.DependencyInjection;

namespace EventCalendar.Tests;

public class EventServiceTests
{
    [Fact]
    public async Task CreateAsync_ShouldPersistEvent_AndMarkInSync_WhenSchedulingSucceeds()
    {
        var fakeClient = new FakeSchedulingKernelClient();
        var provider = DependencyInjectionSetup.InitializeServiceProvider(fakeClient);
        var service = provider.GetRequiredService<IEventService>();

        var result = await service.CreateAsync(new CreateEventRequest
        {
            Title = "Planning Meeting",
            Color = "#3b82f6",
            Timezone = "UTC",
            Schedule = new ScheduleDefinitionPayload
            {
                EvaluatorType = "Rfc5545",
                Rrule = "FREQ=WEEKLY;BYDAY=MO",
                Dtstart = "2026-04-06T09:00:00",
                Timezone = "UTC",
                DurationSeconds = 3600
            }
        }, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("Planning Meeting", result.Title);
        Assert.Equal("InSync", result.ScheduleSyncStatus);
    }

    [Fact]
    public async Task CreateAsync_ShouldMarkPending_WhenSchedulingFails()
    {
        var fakeClient = new FakeSchedulingKernelClient { ThrowOnCreate = true };
        var provider = DependencyInjectionSetup.InitializeServiceProvider(fakeClient);
        var service = provider.GetRequiredService<IEventService>();

        var result = await service.CreateAsync(new CreateEventRequest
        {
            Title = "Ops Event",
            Color = "#ef4444",
            Timezone = "UTC",
            Schedule = new ScheduleDefinitionPayload
            {
                EvaluatorType = "Rfc5545",
                Rrule = "FREQ=DAILY;COUNT=3",
                Dtstart = "2026-04-06T09:00:00",
                Timezone = "UTC",
                DurationSeconds = 900
            }
        }, CancellationToken.None);

        Assert.Equal("Pending", result.ScheduleSyncStatus);
    }

    [Fact]
    public async Task ExpandOccurrencesAsync_ShouldEnrichOccurrences_WithEventMetadata()
    {
        var fakeClient = new FakeSchedulingKernelClient();
        fakeClient.Occurrences.Add(new SchedulingOccurrenceResponse
        {
            ModuleType = "Event",
            ModuleEntityId = "dummy",
            StartUtc = DateTime.Parse("2026-04-06T10:00:00Z"),
            EndUtc = DateTime.Parse("2026-04-06T11:00:00Z")
        });

        var provider = DependencyInjectionSetup.InitializeServiceProvider(fakeClient);
        var service = provider.GetRequiredService<IEventService>();

        var created = await service.CreateAsync(new CreateEventRequest
        {
            Title = "Review Session",
            Color = "#10b981",
            Timezone = "UTC",
            Schedule = new ScheduleDefinitionPayload
            {
                EvaluatorType = "Rfc5545",
                Rrule = "FREQ=DAILY;COUNT=3",
                Dtstart = "2026-04-06T09:00:00",
                Timezone = "UTC",
                DurationSeconds = 3600
            }
        }, CancellationToken.None);

        var expanded = await service.ExpandOccurrencesAsync(created.Id, new ExpandOccurrencesRequest
        {
            RangeStartUtc = DateTime.Parse("2026-04-06T00:00:00Z"),
            RangeEndUtc = DateTime.Parse("2026-04-10T00:00:00Z")
        }, CancellationToken.None);

        Assert.NotNull(expanded);
        Assert.Single(expanded!.Occurrences);
        Assert.Equal(created.Id, expanded.Occurrences[0].EventId);
        Assert.Equal("Review Session", expanded.Occurrences[0].EventTitle);
    }
}
