using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EventCalendar.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialEventCalendar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CalendarEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    Color = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Timezone = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    ScheduleSyncStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    LastScheduleSyncAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModuleType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ModuleEntityId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarEvents", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_IsDeleted_CreatedAtUtc",
                table: "CalendarEvents",
                columns: new[] { "IsDeleted", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_ModuleEntityId",
                table: "CalendarEvents",
                column: "ModuleEntityId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CalendarEvents");
        }
    }
}
