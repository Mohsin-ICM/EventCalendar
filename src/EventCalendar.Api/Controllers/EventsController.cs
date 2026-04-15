using Asp.Versioning;
using EventCalendar.Application.DTOs;
using EventCalendar.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace EventCalendar.Api.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("v{version:apiVersion}/events")]
public class EventsController : ControllerBase
{
    private readonly IEventService _eventService;

    public EventsController(IEventService eventService)
    {
        _eventService = eventService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var events = await _eventService.GetAllActiveAsync(cancellationToken);
        return Ok(events);
    }

    [HttpGet("{eventId:guid}")]
    public async Task<IActionResult> GetById(Guid eventId, CancellationToken cancellationToken)
    {
        var result = await _eventService.GetByIdAsync(eventId, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateEventRequest request, CancellationToken cancellationToken)
    {
        var created = await _eventService.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { eventId = created.Id, version = "1" }, created);
    }

    [HttpPut("{eventId:guid}")]
    public async Task<IActionResult> Update(Guid eventId, [FromBody] UpdateEventRequest request, CancellationToken cancellationToken)
    {
        var result = await _eventService.UpdateAsync(eventId, request, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("{eventId:guid}")]
    public async Task<IActionResult> Delete(Guid eventId, CancellationToken cancellationToken)
    {
        var deleted = await _eventService.DeleteAsync(eventId, cancellationToken);
        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("validate-schedule")]
    public async Task<IActionResult> ValidateSchedule(
        [FromBody] ValidateScheduleRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _eventService.ValidateScheduleAsync(request, cancellationToken);
        if (!result.Valid)
            return BadRequest(result);
        return Ok(result);
    }

    [HttpPost("{eventId:guid}/occurrences/expand")]
    public async Task<IActionResult> ExpandOccurrences(
        Guid eventId,
        [FromBody] ExpandOccurrencesRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _eventService.ExpandOccurrencesAsync(eventId, request, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("{eventId:guid}/occurrences/overrides")]
    public async Task<IActionResult> UpsertOverride(
        Guid eventId,
        [FromBody] UpsertOverrideRequest request,
        CancellationToken cancellationToken)
    {
        var done = await _eventService.UpsertOverrideAsync(eventId, request, cancellationToken);
        return done ? Ok() : NotFound();
    }

    [HttpPost("{eventId:guid}/schedule/split")]
    public async Task<IActionResult> SplitSchedule(
        Guid eventId,
        [FromBody] SplitScheduleRequest request,
        CancellationToken cancellationToken)
    {
        var done = await _eventService.SplitScheduleAsync(eventId, request, cancellationToken);
        return done ? Ok() : NotFound();
    }
}
