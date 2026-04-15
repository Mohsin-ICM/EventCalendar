using EventCalendar.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EventCalendar.Infrastructure.Persistence.Configurations;

public class CalendarEventConfiguration : IEntityTypeConfiguration<CalendarEvent>
{
    public void Configure(EntityTypeBuilder<CalendarEvent> builder)
    {
        builder.ToTable("CalendarEvents");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Title).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(4000);
        builder.Property(x => x.Color).HasMaxLength(32).IsRequired();
        builder.Property(x => x.Timezone).HasMaxLength(100).IsRequired();
        builder.Property(x => x.ModuleType).HasMaxLength(50).IsRequired();
        builder.Property(x => x.ModuleEntityId).HasMaxLength(100).IsRequired();
        builder.Property(x => x.ScheduleSyncStatus).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.HasIndex(x => x.ModuleEntityId).IsUnique();
        builder.HasIndex(x => new { x.IsDeleted, x.CreatedAtUtc });
    }
}
