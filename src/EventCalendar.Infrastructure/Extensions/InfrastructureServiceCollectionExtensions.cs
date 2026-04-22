using EventCalendar.Application.Interfaces;
using EventCalendar.Application.Options;
using EventCalendar.Infrastructure.Clients;
using EventCalendar.Infrastructure.Persistence;
using EventCalendar.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SchedulingService.Grpc;

namespace EventCalendar.Infrastructure.Extensions;

public static class InfrastructureServiceCollectionExtensions
{
    public static IServiceCollection AddEventCalendarInfrastructureServices(
        this IServiceCollection services,
        string connectionString,
        IConfiguration configuration)
    {
        services.AddDbContext<EventCalendarDbContext>(options =>
        {
            options.UseNpgsql(connectionString);
        });

        services.AddScoped<IEventRepository, EventRepository>();

        var scheduling = configuration.GetSection(SchedulingClientOptions.SectionName).Get<SchedulingClientOptions>()
            ?? new SchedulingClientOptions();
        var grpcUrl = string.IsNullOrWhiteSpace(scheduling.GrpcUrl) ? scheduling.BaseUrl : scheduling.GrpcUrl;
        if (string.IsNullOrWhiteSpace(grpcUrl))
            throw new InvalidOperationException("SchedulingKernel BaseUrl or GrpcUrl must be configured for the scheduling gRPC client.");

        services.AddHttpContextAccessor();
        services.AddTransient<BearerTokenInterceptor>();
        services.AddSchedulesGrpcClient(options => options.Address = new Uri(grpcUrl))
            .AddInterceptor<BearerTokenInterceptor>();
        services.AddScoped<ISchedulingKernelClient, SchedulingKernelGrpcClient>();

        return services;
    }
}
