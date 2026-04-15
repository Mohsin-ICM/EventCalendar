param(
    [string]$SwaggerUrl = "http://localhost:8081/swagger/v1/swagger.json",
    [string]$OutputPath = "src/EventCalendar.Infrastructure/Clients/Generated"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command nswag -ErrorAction SilentlyContinue)) {
    dotnet tool install --global NSwag.ConsoleCore | Out-Null
}

if (-not (Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath | Out-Null
}

nswag openapi2csclient `
    /input:$SwaggerUrl `
    /classname:SchedulingServiceGeneratedClient `
    /namespace:EventCalendar.Infrastructure.Clients.Generated `
    /output:"$OutputPath/SchedulingServiceGeneratedClient.cs" `
    /InjectHttpClient:true `
    /UseBaseUrl:false `
    /GenerateClientInterfaces:true `
    /UseRequestAndResponseSerializationSettings:true

Write-Host "Generated client at $OutputPath/SchedulingServiceGeneratedClient.cs"
