using EventCalendar.Application.DTOs;

namespace EventCalendar.Application.Interfaces;

public interface IEventService
{
    Task<EventResponse> CreateAsync(CreateEventRequest request, CancellationToken cancellationToken);
    Task<EventResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<List<EventListItemResponse>> GetAllActiveAsync(CancellationToken cancellationToken);
    Task<EventResponse?> UpdateAsync(Guid id, UpdateEventRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken);
    Task<ExpandedOccurrencesEnvelope?> ExpandOccurrencesAsync(Guid eventId, ExpandOccurrencesRequest request, CancellationToken cancellationToken);
    Task<bool> UpsertOverrideAsync(Guid eventId, UpsertOverrideRequest request, CancellationToken cancellationToken);
    Task<bool> SplitScheduleAsync(Guid eventId, SplitScheduleRequest request, CancellationToken cancellationToken);
    Task<ValidateScheduleResponse> ValidateScheduleAsync(ValidateScheduleRequest request, CancellationToken cancellationToken);
}
