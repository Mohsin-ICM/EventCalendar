FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY EventCalendarService.sln ./
COPY src/EventCalendar.Api/EventCalendar.Api.csproj src/EventCalendar.Api/
COPY src/EventCalendar.Application/EventCalendar.Application.csproj src/EventCalendar.Application/
COPY src/EventCalendar.Domain/EventCalendar.Domain.csproj src/EventCalendar.Domain/
COPY src/EventCalendar.Infrastructure/EventCalendar.Infrastructure.csproj src/EventCalendar.Infrastructure/

RUN dotnet restore src/EventCalendar.Api/EventCalendar.Api.csproj

COPY src/ src/

RUN dotnet publish src/EventCalendar.Api/EventCalendar.Api.csproj -c Release -o /app/publish /p:UseAppHost=false --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "EventCalendar.Api.dll"]
