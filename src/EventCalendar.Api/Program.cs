using System.Text;
using Asp.Versioning;
using EventCalendar.Application.Extensions;
using EventCalendar.Application.Options;
using EventCalendar.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
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

builder.Services.AddOptions<JwtOptions>()
    .BindConfiguration(JwtOptions.SectionName)
    .ValidateDataAnnotations()
    .Validate(
        o => !string.IsNullOrWhiteSpace(o.SigningKey),
        "Jwt:SigningKey is required. For local development use appsettings.Development.json or user secrets; in production set environment variable Jwt__SigningKey.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
            ?? throw new InvalidOperationException($"Configuration section '{JwtOptions.SectionName}' is missing.");
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = jwt.ValidateIssuer,
            ValidateAudience = jwt.ValidateAudience,
            ValidateLifetime = jwt.ValidateLifetime,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.ValidIssuer,
            ValidAudience = jwt.ValidAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("Rw_kb0hBDVFZvLub-bPFoaV59eHGS5z6QHBq4o0h_VQ")),
            ClockSkew = TimeSpan.FromSeconds(jwt.ClockSkewSeconds)
        };
    });

builder.Services.AddAuthorization();

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

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT: prefix the token with 'Bearer ' (Authorization header).",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = JwtBearerDefaults.AuthenticationScheme,
        BearerFormat = "JWT"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
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
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/healthz/live").AllowAnonymous();
app.MapHealthChecks("/healthz/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
}).AllowAnonymous();

app.MapControllers();
app.Run();
