using System.ComponentModel.DataAnnotations;

namespace EventCalendar.Application.Options;

/// <summary>Symmetric JWT validation settings (must match the issuer of tokens your clients use).</summary>
public class JwtOptions
{
    public const string SectionName = "Jwt";

    /// <summary>Secret used to validate the token signature (HMAC-SHA256). Store in user secrets or environment in development/production.</summary>
    [Required]
    public string SigningKey { get; set; } = string.Empty;

    public bool ValidateIssuer { get; set; }

    public bool ValidateAudience { get; set; }

    public bool ValidateLifetime { get; set; } = true;

    /// <summary>Clock skew applied when validating expiry. Default 0 matches strict validation.</summary>
    public int ClockSkewSeconds { get; set; }

    /// <summary>When <see cref="ValidateIssuer"/> is true, the expected issuer.</summary>
    public string? ValidIssuer { get; set; }

    /// <summary>When <see cref="ValidateAudience"/> is true, the expected audience.</summary>
    public string? ValidAudience { get; set; }
}
