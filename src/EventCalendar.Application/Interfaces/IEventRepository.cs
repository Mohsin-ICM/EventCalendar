using EventCalendar.Domain.Entities;

namespace EventCalendar.Application.Interfaces;

public interface IEventRepository
{
    Task AddAsync(CalendarEvent calendarEvent, CancellationToken cancellationToken);
    Task<CalendarEvent?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<List<CalendarEvent>> GetActiveAsync(CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
