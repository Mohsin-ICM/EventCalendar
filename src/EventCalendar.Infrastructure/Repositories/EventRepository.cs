using EventCalendar.Application.Interfaces;
using EventCalendar.Domain.Entities;
using EventCalendar.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EventCalendar.Infrastructure.Repositories;

public class EventRepository : IEventRepository
{
    private readonly EventCalendarDbContext _dbContext;

    public EventRepository(EventCalendarDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task AddAsync(CalendarEvent calendarEvent, CancellationToken cancellationToken)
    {
        return _dbContext.Events.AddAsync(calendarEvent, cancellationToken).AsTask();
    }

    public Task<CalendarEvent?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        return _dbContext.Events.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
    }

    public Task<List<CalendarEvent>> GetActiveAsync(CancellationToken cancellationToken)
    {
        return _dbContext.Events
            .Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        return _dbContext.SaveChangesAsync(cancellationToken);
    }
}
