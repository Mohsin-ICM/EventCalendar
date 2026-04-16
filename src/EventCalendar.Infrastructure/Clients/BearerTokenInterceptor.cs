using Grpc.Core;
using Grpc.Core.Interceptors;
using Microsoft.AspNetCore.Http;

namespace EventCalendar.Infrastructure.Clients;

/// <summary>
/// Forwards the incoming HTTP request's <c>Authorization: Bearer …</c> header
/// to every outgoing gRPC call made via the injected client.
/// </summary>
internal sealed class BearerTokenInterceptor : Interceptor
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public BearerTokenInterceptor(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public override AsyncUnaryCall<TResponse> AsyncUnaryCall<TRequest, TResponse>(
        TRequest request,
        ClientInterceptorContext<TRequest, TResponse> context,
        AsyncUnaryCallContinuation<TRequest, TResponse> continuation)
    {
        return continuation(request, WithAuthHeader(context));
    }

    private ClientInterceptorContext<TRequest, TResponse> WithAuthHeader<TRequest, TResponse>(
        ClientInterceptorContext<TRequest, TResponse> context)
        where TRequest : class
        where TResponse : class
    {
        var authHeader = _httpContextAccessor.HttpContext?
            .Request.Headers.Authorization
            .FirstOrDefault();

        if (string.IsNullOrEmpty(authHeader))
            return context;

        var headers = new Metadata();
        if (context.Options.Headers is { } existing)
        {
            foreach (var entry in existing)
            {
                if (entry.IsBinary)
                    headers.Add(entry.Key, entry.ValueBytes);
                else
                    headers.Add(entry.Key, entry.Value ?? string.Empty);
            }
        }

        // Only add if not already present (guards against double-injection).
        if (headers.All(e => !string.Equals(e.Key, "authorization", StringComparison.OrdinalIgnoreCase)))
            headers.Add("authorization", authHeader);

        var options = context.Options.WithHeaders(headers);
        return new ClientInterceptorContext<TRequest, TResponse>(context.Method, context.Host, options);
    }
}
