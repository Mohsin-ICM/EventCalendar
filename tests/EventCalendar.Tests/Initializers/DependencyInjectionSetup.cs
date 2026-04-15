using EventCalendar.Application.Extensions;
using EventCalendar.Application.Interfaces;
using EventCalendar.Infrastructure.Persistence;
using EventCalendar.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EventCalendar.Tests.Initializers;

internal static class DependencyInjectionSetup
{
    internal static ServiceProvider InitializeServiceProvider(FakeSchedulingKernelClient schedulingClient)
    {
        var services = new ServiceCollection();
        services.AddLogging();

        services.AddDbContext<EventCalendarDbContext>(options =>
            options.UseInMemoryDatabase($"EventCalendarTestDb_{Guid.NewGuid()}"));

        services.AddScoped<IEventRepository, EventRepository>();
        services.AddScoped<ISchedulingKernelClient>(_ => schedulingClient);
        services.AddEventCalendarApplicationServices();

        return services.BuildServiceProvider();
    }
}
