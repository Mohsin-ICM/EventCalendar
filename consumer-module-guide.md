# Using the `SchedulingService.Grpc` package from a consumer module

This guide explains how another service or module (for example Event Calendar) should reference and call **Scheduling Service** over gRPC using the **`SchedulingService.Grpc`** NuGet package.

## What you get in the package

The package ships:

- Generated message types and enums under `SchedulingService.Grpc.Schedules.V1` (matching `schedules.v1` in the `.proto` file).
- A strongly typed client: `SchedulesGrpc.SchedulesGrpcClient`.
- An optional DI helper: `AddSchedulesGrpcClient`, which registers that client with `Grpc.Net.ClientFactory` so you can inject it into constructors.

You do **not** need to add `.proto` files or `Grpc.Tools` to the consumer project; the package already contains the compiled contract.

## Requirements

- **Target framework:** The package currently targets **.NET 9.0**. Consumer apps should target `net9.0` (or a compatible TFM your team agrees on if the package is multi-targeted later).
- **Scheduling Service URL:** Use the base URL of the API host that exposes gRPC (same process as the REST API unless you split listeners). The client uses **HTTP/2**; the address is typically `https://…` in production.

## 1. Add the NuGet package

After you publish `SchedulingService.Grpc` to your feed (or use a project reference during local development), add:

```xml
<ItemGroup>
  <PackageReference Include="SchedulingService.Grpc" Version="1.0.0" />
</ItemGroup>
```

Match the **version** to the package your team publishes; bump it when the contract changes.

## 2. Configuration

Store the scheduling service base address in configuration (do not hard-code in source):

```json
{
  "SchedulingService": {
    "GrpcUrl": "https://scheduling.internal:443"
  }
}
```

For local development against the API project’s HTTPS endpoint, use something like `https://localhost:7xxx` (use the port from `launchSettings.json` or your run profile).

## 3. Register the client (ASP.NET Core)

In `Program.cs` (or your composition root), register the client and bind the URL from configuration:

```csharp
using SchedulingService.Grpc;

var schedulingGrpcUrl = builder.Configuration["SchedulingService:GrpcUrl"]
    ?? throw new InvalidOperationException("SchedulingService:GrpcUrl is required.");

builder.Services.AddSchedulesGrpcClient(options =>
{
    options.Address = new Uri(schedulingGrpcUrl);
});
```

Inject the client where needed:

```csharp
using SchedulingService.Grpc.Schedules.V1;

public class EventCalendarSchedulingClient
{
    private readonly SchedulesGrpc.SchedulesGrpcClient _client;

    public EventCalendarSchedulingClient(SchedulesGrpc.SchedulesGrpcClient client)
    {
        _client = client;
    }

    // Use _client.CreateScheduleAsync, ExpandByReferenceAsync, etc.
}
```

Register your wrapper in DI as usual (`AddScoped`, `AddSingleton`, etc., depending on how you share the underlying gRPC client).

### Optional: named or multiple clients

If you need more than one endpoint or custom wiring, you can still use the standard `AddGrpcClient<SchedulesGrpc.SchedulesGrpcClient>(…)` overloads from `Grpc.Net.ClientFactory` directly (for example a **named** client). The `AddSchedulesGrpcClient` extension is the default single-endpoint case.

## 4. Console or worker (no DI helper)

If you are not using `Microsoft.Extensions.DependencyInjection` for gRPC, create a channel and client explicitly:

```csharp
using Grpc.Net.Client;
using SchedulingService.Grpc.Schedules.V1;

using var channel = GrpcChannel.ForAddress("https://localhost:5001");
var client = new SchedulesGrpc.SchedulesGrpcClient(channel);
```

Dispose the channel when the application shuts down. A fuller standalone sample lives in [schedules-client-sample.cs](./schedules-client-sample.cs).

## 5. Choosing the right `ModuleType`

Requests include a **`ModuleType`** so Scheduling Service can scope data by domain. For an event-oriented module, use **`ModuleType.Event`** when creating or querying schedules tied to calendar events. Other values (`Task`, `Appointment`, etc.) are for other product areas; see the generated enum in `SchedulingService.Grpc.Schedules.V1`.

## 6. Errors and status codes

gRPC calls throw **`RpcException`** on failure. Typical cases:

- **`InvalidArgument`** — validation failed (for example bad RRULE or dates).
- **`NotFound`** — entity or schedule not found, depending on the RPC.

Handle these in your module’s application layer and map them to your API’s HTTP or UI responses as appropriate.

## 7. TLS and development certificates

For **HTTPS** endpoints, the gRPC channel validates the server certificate. In development, ensure the ASP.NET Core developer certificate is trusted, or configure `GrpcChannel` options to relax validation only in controlled dev scenarios (never in production).

## 8. Authentication (when the scheduling API requires JWT)

If the Scheduling Service instance is behind the same JWT validation as its REST endpoints, outbound gRPC calls may need an **`Authorization: Bearer …`** metadata entry on each call. How you obtain the token depends on your platform (on-behalf-of the user, client credentials, etc.). Typical approaches:

- Attach a **call credential** or **interceptor** on the `GrpcChannel` / client factory so every call adds the current request’s bearer token.
- Configure **`ConfigurePrimaryHttpMessageHandler`** / channel options if your infrastructure uses a shared HTTP handler for tokens.

Consult your security team’s standard for service-to-service calls; the contract in `SchedulingService.Grpc` does not change based on auth.

## 9. Contract and version alignment

- Keep the **NuGet package version** in sync with the **Scheduling Service** deployment you call. Breaking `.proto` changes should bump the package major or minor version according to your API versioning policy.
- If you only need read-only expansion, **`ExpandByReference`** and **`GetSchedulesByEntity`** are common entry points for modules that already store a `module_entity_id` in their own database.

## Summary

| Step | Action |
|------|--------|
| 1 | Add package `SchedulingService.Grpc`. |
| 2 | Configure base URL (`SchedulingService:GrpcUrl` or equivalent). |
| 3 | Call `AddSchedulesGrpcClient` or `GrpcChannel.ForAddress` + `SchedulesGrpcClient`. |
| 4 | Use `SchedulingService.Grpc.Schedules.V1` types and set `ModuleType` for your domain (e.g. `Event`). |
| 5 | Handle `RpcException` and wire authentication if required by your environment. |

For a minimal end-to-end call sequence, see [schedules-client-sample.cs](./schedules-client-sample.cs).
