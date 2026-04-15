using EventCalendar.Application.Interfaces;
using EventCalendar.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace EventCalendar.Application.Extensions;

public static class ApplicationServiceCollectionExtensions
{
    public static IServiceCollection AddEventCalendarApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<IEventService, EventService>();
        return services;
    }
}
