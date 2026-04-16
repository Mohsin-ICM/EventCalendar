using Asp.Versioning;
using EventCalendar.Application.Extensions;
using EventCalendar.Application.Options;
using EventCalendar.Infrastructure.Extensions;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("UiDevCors", policy =>
    {
        policy
            .WithOrigins("http://localhost:4200", "https://localhost:4200")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
})
.AddMvc()
.AddApiExplorer(options =>
{
    options.GroupNameFormat = "'v'VVV";
    options.SubstituteApiVersionInUrl = true;
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Event Calendar API",
        Version = "v1",
        Description = "Event Calendar facade over Scheduling Service."
    });
});

builder.Services.Configure<SchedulingClientOptions>(
    builder.Configuration.GetSection(SchedulingClientOptions.SectionName));

var dbConnectionString = builder.Configuration.GetConnectionString("EventCalendarDb")
    ?? "Host=localhost:5432;Database=EventCalendarService;Username=user_mnb;Password=Mnb@312455";

builder.Services.AddEventCalendarInfrastructureServices(dbConnectionString, builder.Configuration);
builder.Services.AddEventCalendarApplicationServices();
builder.Services.AddHealthChecks().AddNpgSql(dbConnectionString, name: "postgres", tags: ["ready"]);

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("UiDevCors");
app.UseAuthorization();
app.MapHealthChecks("/healthz/live");
app.MapHealthChecks("/healthz/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
app.MapControllers();
app.Run();
