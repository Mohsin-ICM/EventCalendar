using EventCalendar.Application.DTOs;
using EventCalendar.Application.Interfaces;
using EventCalendar.Application.Mapping;
using EventCalendar.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace EventCalendar.Application.Services;

public class EventService : IEventService
{
    private readonly IEventRepository _eventRepository;
    private readonly ISchedulingKernelClient _schedulingKernelClient;
    private readonly ILogger<EventService> _logger;

    public EventService(
        IEventRepository eventRepository,
        ISchedulingKernelClient schedulingKernelClient,
        ILogger<EventService> logger)
    {
        _eventRepository = eventRepository;
        _schedulingKernelClient = schedulingKernelClient;
        _logger = logger;
    }

    public async Task<EventResponse> CreateAsync(CreateEventRequest request, CancellationToken cancellationToken)
    {
        var calendarEvent = CalendarEvent.Create(
            request.Title,
            request.Description,
            request.Color,
            request.Timezone);

        await _eventRepository.AddAsync(calendarEvent, cancellationToken);
        await _eventRepository.SaveChangesAsync(cancellationToken);

        if (request.Schedule is not null)
        {
            try
            {
                await _schedulingKernelClient.CreateScheduleAsync(
                    calendarEvent.ModuleType,
                    calendarEvent.ModuleEntityId,
                    request.Schedule,
                    cancellationToken);

                calendarEvent.MarkScheduleInSync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Schedule upsert failed for event {EventId}", calendarEvent.Id);
                calendarEvent.MarkSchedulePendingSync();
            }

            await _eventRepository.SaveChangesAsync(cancellationToken);
        }

        return calendarEvent.ToResponse(request.Schedule);
    }

    public async Task<EventResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var calendarEvent = await _eventRepository.GetByIdAsync(id, cancellationToken);
        if (calendarEvent is null || calendarEvent.IsDeleted)
            return null;

        ScheduleDefinitionPayload? schedule = null;
        try
        {
            schedule = await _schedulingKernelClient.GetScheduleAsync(
                calendarEvent.ModuleType,
                calendarEvent.ModuleEntityId,
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Unable to fetch schedule for event {EventId}", id);
        }

        return calendarEvent.ToResponse(schedule);
    }

    public async Task<List<EventListItemResponse>> GetAllActiveAsync(CancellationToken cancellationToken)
    {
        var events = await _eventRepository.GetActiveAsync(cancellationToken);
        return events.Select(e => e.ToListItem()).ToList();
    }

    public async Task<EventResponse?> UpdateAsync(Guid id, UpdateEventRequest request, CancellationToken cancellationToken)
    {
        var calendarEvent = await _eventRepository.GetByIdAsync(id, cancellationToken);
        if (calendarEvent is null || calendarEvent.IsDeleted)
            return null;

        calendarEvent.UpdateMetadata(request.Title, request.Description, request.Color, request.Timezone);

        if (request.Schedule is not null)
        {
            try
            {
                await _schedulingKernelClient.CreateScheduleAsync(
                    calendarEvent.ModuleType,
                    calendarEvent.ModuleEntityId,
                    request.Schedule,
                    cancellationToken);

                calendarEvent.MarkScheduleInSync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Schedule upsert failed for event {EventId}", id);
                calendarEvent.MarkSchedulePendingSync();
            }
        }

        await _eventRepository.SaveChangesAsync(cancellationToken);
        return calendarEvent.ToResponse(request.Schedule);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var calendarEvent = await _eventRepository.GetByIdAsync(id, cancellationToken);
        if (calendarEvent is null || calendarEvent.IsDeleted)
            return false;

        calendarEvent.MarkDeleted();

        try
        {
            await _schedulingKernelClient.DeleteSchedulesAsync(
                calendarEvent.ModuleType,
                calendarEvent.ModuleEntityId,
                cancellationToken);
            calendarEvent.MarkScheduleInSync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed deleting schedules for event {EventId}", id);
            calendarEvent.MarkSchedulePendingSync();
        }

        await _eventRepository.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<ExpandedOccurrencesEnvelope?> ExpandOccurrencesAsync(
        Guid eventId,
        ExpandOccurrencesRequest request,
        CancellationToken cancellationToken)
    {
        var calendarEvent = await _eventRepository.GetByIdAsync(eventId, cancellationToken);
        if (calendarEvent is null || calendarEvent.IsDeleted)
            return null;

        var expand = await _schedulingKernelClient.ExpandByReferenceAsync(
            new SchedulingExpandByReferenceRequest
            {
                ModuleType = calendarEvent.ModuleType,
                ModuleEntityId = calendarEvent.ModuleEntityId,
                RangeStartUtc = request.RangeStartUtc,
                RangeEndUtc = request.RangeEndUtc,
                MaxOccurrences = request.MaxOccurrences,
                PageSize = request.PageSize,
                Cursor = request.Cursor
            },
            cancellationToken);

        return new ExpandedOccurrencesEnvelope
        {
            NextCursor = expand.NextCursor,
            Occurrences = expand.Occurrences.Select(o => new OccurrenceResponse
            {
                ScheduleId = o.ScheduleId,
                EventId = calendarEvent.Id,
                EventTitle = calendarEvent.Title,
                EventColor = calendarEvent.Color,
                ModuleType = o.ModuleType,
                ModuleEntityId = o.ModuleEntityId,
                StartUtc = o.StartUtc,
                EndUtc = o.EndUtc
            }).ToList()
        };
    }

    public async Task<bool> UpsertOverrideAsync(
        Guid eventId,
        UpsertOverrideRequest request,
        CancellationToken cancellationToken)
    {
        var calendarEvent = await _eventRepository.GetByIdAsync(eventId, cancellationToken);
        if (calendarEvent is null || calendarEvent.IsDeleted)
            return false;

        await _schedulingKernelClient.UpsertOverrideAsync(
            calendarEvent.ModuleType,
            calendarEvent.ModuleEntityId,
            request.ScheduleId,
            request,
            cancellationToken);

        calendarEvent.MarkScheduleInSync();
        await _eventRepository.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> SplitScheduleAsync(
        Guid eventId,
        SplitScheduleRequest request,
        CancellationToken cancellationToken)
    {
        var calendarEvent = await _eventRepository.GetByIdAsync(eventId, cancellationToken);
        if (calendarEvent is null || calendarEvent.IsDeleted)
            return false;

        await _schedulingKernelClient.SplitScheduleAsync(
            calendarEvent.ModuleType,
            calendarEvent.ModuleEntityId,
            request.ScheduleId,
            request,
            cancellationToken);

        calendarEvent.MarkScheduleInSync();
        await _eventRepository.SaveChangesAsync(cancellationToken);
        return true;
    }

    public Task<ValidateScheduleResponse> ValidateScheduleAsync(
        ValidateScheduleRequest request,
        CancellationToken cancellationToken)
    {
        return _schedulingKernelClient.ValidateScheduleAsync(request.Schedule, cancellationToken);
    }
}
