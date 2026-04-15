using EventCalendar.Application.Interfaces;
using EventCalendar.Application.Options;
using EventCalendar.Infrastructure.Clients;
using EventCalendar.Infrastructure.Persistence;
using EventCalendar.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EventCalendar.Infrastructure.Extensions;

public static class InfrastructureServiceCollectionExtensions
{
    public static IServiceCollection AddEventCalendarInfrastructureServices(
        this IServiceCollection services,
        string connectionString)
    {
        services.AddDbContext<EventCalendarDbContext>(options =>
        {
            options.UseNpgsql(connectionString);
        });

        services.AddScoped<IEventRepository, EventRepository>();

        services.AddHttpClient<ISchedulingKernelClient, SchedulingKernelHttpClient>((sp, httpClient) =>
        {
            var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<SchedulingClientOptions>>().Value;
            httpClient.BaseAddress = new Uri(options.BaseUrl);
        });

        return services;
    }
}
