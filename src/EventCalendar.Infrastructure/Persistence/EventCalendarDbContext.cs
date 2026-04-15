using EventCalendar.Domain.Entities;
using EventCalendar.Infrastructure.Persistence.Configurations;
using Microsoft.EntityFrameworkCore;

namespace EventCalendar.Infrastructure.Persistence;

public class EventCalendarDbContext : DbContext
{
    public EventCalendarDbContext(DbContextOptions<EventCalendarDbContext> options) : base(options)
    {
    }

    public DbSet<CalendarEvent> Events => Set<CalendarEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new CalendarEventConfiguration());
        base.OnModelCreating(modelBuilder);
    }
}
