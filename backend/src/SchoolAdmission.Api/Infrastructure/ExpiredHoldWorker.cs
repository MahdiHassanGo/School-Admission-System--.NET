using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Domain;

namespace SchoolAdmission.Api.Infrastructure;

public class ExpiredHoldWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ExpiredHoldWorker> _logger;
    private readonly TimeSpan _sweepInterval = TimeSpan.FromSeconds(2);

    public ExpiredHoldWorker(IServiceProvider serviceProvider, ILogger<ExpiredHoldWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("ExpiredHoldWorker started with interval {Interval}s.", _sweepInterval.TotalSeconds);

        using var timer = new PeriodicTimer(_sweepInterval);

        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await SweepExpiredHoldsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while sweeping expired holds.");
            }
        }

        _logger.LogInformation("ExpiredHoldWorker stopped.");
    }

    private async Task SweepExpiredHoldsAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = DateTime.UtcNow;

        var affectedRows = await context.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE admission_holds SET status = 'EXPIRED' WHERE status = 'HELD' AND expires_at <= {now}",
            cancellationToken);

        if (affectedRows > 0)
        {
            _logger.LogInformation("ExpiredHoldWorker marked {Count} overdue holds as EXPIRED.", affectedRows);
        }
    }
}
