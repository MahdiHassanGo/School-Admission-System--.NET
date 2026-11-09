using System.Data;
using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Domain;
using SchoolAdmission.Api.Infrastructure;

namespace SchoolAdmission.Api.Features.Holds;

public interface IHoldService
{
    Task<CreateHoldResponse> CreateHoldAsync(string classId, string studentId, CancellationToken cancellationToken = default);
    Task<HoldDetailResponse> GetHoldByIdAsync(string holdId, CancellationToken cancellationToken = default);
    Task<ConfirmHoldResponse> ConfirmHoldAsync(string holdId, string studentId, CancellationToken cancellationToken = default);
    Task CancelHoldAsync(string holdId, string studentId, CancellationToken cancellationToken = default);
    Task<List<StudentHoldSummaryResponse>> GetMyHoldsAsync(string studentId, CancellationToken cancellationToken = default);
}

public class HoldService : IHoldService
{
    private readonly AppDbContext _context;
    private readonly int _holdDurationSeconds;
    private readonly ILogger<HoldService> _logger;

    public HoldService(AppDbContext context, IConfiguration configuration, ILogger<HoldService> logger)
    {
        _context = context;
        _logger = logger;

        if (int.TryParse(configuration["HOLD_DURATION_SECONDS"], out var duration) && duration > 0)
        {
            _holdDurationSeconds = duration;
        }
        else
        {
            _holdDurationSeconds = 600;
        }
    }

    public async Task<CreateHoldResponse> CreateHoldAsync(string classId, string studentId, CancellationToken cancellationToken = default)
    {
        StudentIdValidator.Validate(studentId);

        await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

        // 1. Serialize via PostgreSQL row lock on the admission class
        var targetClass = await _context.AdmissionClasses
            .FromSqlInterpolated($"SELECT * FROM admission_classes WHERE id = {classId} FOR UPDATE")
            .FirstOrDefaultAsync(cancellationToken);

        if (targetClass == null)
        {
            throw new NotFoundException($"Class with ID '{classId}' was not found.");
        }

        // 2. Fetch current database timestamp
        var dbTime = await _context.Database
            .SqlQueryRaw<DateTime>("SELECT clock_timestamp() AS \"Value\"")
            .FirstAsync(cancellationToken);

        // 3. Eagerly expire any overdue HELD records for this class
        await _context.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE admission_holds SET status = 'EXPIRED' WHERE class_id = {classId} AND status = 'HELD' AND expires_at <= {dbTime}",
            cancellationToken);

        // 4. Check if student already has an active (HELD) or CONFIRMED hold for this class
        var hasActiveOrConfirmedHold = await _context.AdmissionHolds
            .AnyAsync(h => h.ClassId == classId
                           && h.StudentId == studentId
                           && (h.Status == HoldStatus.HELD || h.Status == HoldStatus.CONFIRMED), cancellationToken);

        if (hasActiveOrConfirmedHold)
        {
            throw new ConflictException("You already have an active or confirmed admission hold for this class.");
        }

        // 5. Count occupied seats (active held + confirmed)
        var activeHeldSeats = await _context.AdmissionHolds
            .CountAsync(h => h.ClassId == classId && h.Status == HoldStatus.HELD && h.ExpiresAt > dbTime, cancellationToken);

        var confirmedSeats = await _context.AdmissionHolds
            .CountAsync(h => h.ClassId == classId && h.Status == HoldStatus.CONFIRMED, cancellationToken);

        if (activeHeldSeats + confirmedSeats >= targetClass.TotalSeats)
        {
            throw new ConflictException("No seats are currently available in this class.");
        }

        // 6. Create new hold
        var holdId = $"h_{Guid.NewGuid():N}";
        var expiresAt = dbTime.AddSeconds(_holdDurationSeconds);

        var hold = new AdmissionHold
        {
            Id = holdId,
            ClassId = classId,
            StudentId = studentId,
            Status = HoldStatus.HELD,
            CreatedAt = dbTime,
            ExpiresAt = expiresAt
        };

        _context.AdmissionHolds.Add(hold);
        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new CreateHoldResponse(
            hold.Id,
            hold.ClassId,
            hold.StudentId,
            hold.Status.ToString(),
            hold.ExpiresAt
        );
    }

    public async Task<HoldDetailResponse> GetHoldByIdAsync(string holdId, CancellationToken cancellationToken = default)
    {
        var hold = await _context.AdmissionHolds
            .AsNoTracking()
            .FirstOrDefaultAsync(h => h.Id == holdId, cancellationToken);

        if (hold == null)
        {
            throw new NotFoundException($"Hold with ID '{holdId}' was not found.");
        }

        var effectiveStatus = hold.Status;
        if (effectiveStatus == HoldStatus.HELD && hold.ExpiresAt <= DateTime.UtcNow)
        {
            effectiveStatus = HoldStatus.EXPIRED;
        }

        return new HoldDetailResponse(
            hold.Id,
            hold.ClassId,
            effectiveStatus.ToString(),
            hold.ExpiresAt
        );
    }

    public async Task<ConfirmHoldResponse> ConfirmHoldAsync(string holdId, string studentId, CancellationToken cancellationToken = default)
    {
        StudentIdValidator.Validate(studentId);

        await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

        // Lock the hold row for update
        var hold = await _context.AdmissionHolds
            .FromSqlInterpolated($"SELECT * FROM admission_holds WHERE id = {holdId} FOR UPDATE")
            .FirstOrDefaultAsync(cancellationToken);

        if (hold == null)
        {
            throw new NotFoundException($"Hold with ID '{holdId}' was not found.");
        }

        if (hold.StudentId != studentId)
        {
            throw new ForbiddenException("You are not authorized to confirm this hold.");
        }

        if (hold.Status == HoldStatus.CONFIRMED)
        {
            // Idempotent: already confirmed
            return new ConfirmHoldResponse(hold.Id, "CONFIRMED");
        }

        if (hold.Status == HoldStatus.CANCELLED)
        {
            throw new ConflictException("Cannot confirm a cancelled hold.");
        }

        var dbTime = await _context.Database
            .SqlQueryRaw<DateTime>("SELECT clock_timestamp() AS \"Value\"")
            .FirstAsync(cancellationToken);

        if (hold.Status == HoldStatus.EXPIRED || hold.ExpiresAt <= dbTime)
        {
            if (hold.Status != HoldStatus.EXPIRED)
            {
                hold.Status = HoldStatus.EXPIRED;
                await _context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            }

            throw new ConflictException("Cannot confirm an expired hold.");
        }

        // Successfully transition HELD -> CONFIRMED
        hold.Status = HoldStatus.CONFIRMED;
        hold.ConfirmedAt = dbTime;

        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new ConfirmHoldResponse(hold.Id, "CONFIRMED");
    }

    public async Task CancelHoldAsync(string holdId, string studentId, CancellationToken cancellationToken = default)
    {
        StudentIdValidator.Validate(studentId);

        await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

        var hold = await _context.AdmissionHolds
            .FromSqlInterpolated($"SELECT * FROM admission_holds WHERE id = {holdId} FOR UPDATE")
            .FirstOrDefaultAsync(cancellationToken);

        if (hold == null)
        {
            throw new NotFoundException($"Hold with ID '{holdId}' was not found.");
        }

        if (hold.StudentId != studentId)
        {
            throw new ForbiddenException("You are not authorized to cancel this hold.");
        }

        if (hold.Status == HoldStatus.CONFIRMED)
        {
            throw new ConflictException("Confirmed admissions cannot be cancelled.");
        }

        if (hold.Status == HoldStatus.CANCELLED)
        {
            // Idempotent cancellation
            return;
        }

        var dbTime = await _context.Database
            .SqlQueryRaw<DateTime>("SELECT clock_timestamp() AS \"Value\"")
            .FirstAsync(cancellationToken);

        hold.Status = HoldStatus.CANCELLED;
        hold.CancelledAt = dbTime;

        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<List<StudentHoldSummaryResponse>> GetMyHoldsAsync(string studentId, CancellationToken cancellationToken = default)
    {
        StudentIdValidator.Validate(studentId);

        var now = DateTime.UtcNow;

        var holds = await _context.AdmissionHolds
            .AsNoTracking()
            .Where(h => h.StudentId == studentId)
            .Include(h => h.Class)
            .OrderByDescending(h => h.CreatedAt)
            .ToListAsync(cancellationToken);

        return holds.Select(h =>
        {
            var effectiveStatus = h.Status;
            if (effectiveStatus == HoldStatus.HELD && h.ExpiresAt <= now)
            {
                effectiveStatus = HoldStatus.EXPIRED;
            }

            return new StudentHoldSummaryResponse(
                h.Id,
                h.ClassId,
                h.Class?.Name ?? "Unknown Class",
                effectiveStatus.ToString(),
                h.ExpiresAt
            );
        }).ToList();
    }
}
