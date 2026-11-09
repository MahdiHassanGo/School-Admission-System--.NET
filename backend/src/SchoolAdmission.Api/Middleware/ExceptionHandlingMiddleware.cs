using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.Domain;

namespace SchoolAdmission.Api.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (statusCode, title, detail) = exception switch
        {
            BadRequestException badRequestEx => ((int)HttpStatusCode.BadRequest, "Bad Request", badRequestEx.Message),
            NotFoundException notFoundEx => ((int)HttpStatusCode.NotFound, "Not Found", notFoundEx.Message),
            ConflictException conflictEx => ((int)HttpStatusCode.Conflict, "Conflict", conflictEx.Message),
            ForbiddenException forbiddenEx => ((int)HttpStatusCode.Forbidden, "Forbidden", forbiddenEx.Message),
            BadHttpRequestException badHttpEx => ((int)HttpStatusCode.BadRequest, "Bad Request", badHttpEx.Message),
            JsonException jsonEx => ((int)HttpStatusCode.BadRequest, "Invalid JSON", jsonEx.Message),
            _ => ((int)HttpStatusCode.InternalServerError, "Internal Server Error", "An unexpected error occurred.")
        };

        if (statusCode == (int)HttpStatusCode.InternalServerError)
        {
            _logger.LogError(exception, "Unhandled exception processing request {Path}", context.Request.Path);
        }
        else
        {
            _logger.LogWarning("Request {Path} failed with {StatusCode}: {Detail}", context.Request.Path, statusCode, detail);
        }

        context.Response.ContentType = "application/problem+json";
        context.Response.StatusCode = statusCode;

        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = detail,
            Instance = context.Request.Path
        };

        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(problemDetails, options));
    }
}
