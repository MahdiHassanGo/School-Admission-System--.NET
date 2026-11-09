using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Domain;
using SchoolAdmission.Api.Infrastructure;

namespace SchoolAdmission.Api.Features.Classes;

public interface IClassService
{
    Task<CreateClassResponse> CreateClassAsync(CreateClassRequest request, CancellationToken cancellationToken = default);
    Task<List<ClassResponse>> GetClassesAsync(CancellationToken cancellationToken = default);
    Task<ClassResponse> GetClassByIdAsync(string classId, CancellationToken cancellationToken = default);
}

public class ClassService : IClassService
{
    private readonly AppDbContext _context;

    public ClassService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<CreateClassResponse> CreateClassAsync(CreateClassRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new BadRequestException("Class name cannot be empty.");
        }

        if (request.TotalSeats <= 0)
        {
            throw new BadRequestException("Total seats must be greater than zero.");
        }

        var admissionClass = new AdmissionClass
        {
            Id = $"c_{Guid.NewGuid():N}",
            Name = request.Name.Trim(),
            TotalSeats = request.TotalSeats,
            CreatedAt = DateTime.UtcNow
        };

        _context.AdmissionClasses.Add(admissionClass);
        await _context.SaveChangesAsync(cancellationToken);

        return new CreateClassResponse(
            admissionClass.Id,
            admissionClass.Name,
            admissionClass.TotalSeats
        );
    }

    public async Task<List<ClassResponse>> GetClassesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;

        var classes = await _context.AdmissionClasses
            .AsNoTracking()
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.TotalSeats,
                c.CreatedAt,
                HeldSeats = c.Holds.Count(h => h.Status == HoldStatus.HELD && h.ExpiresAt > now),
                ConfirmedSeats = c.Holds.Count(h => h.Status == HoldStatus.CONFIRMED)
            })
            .OrderBy(c => c.CreatedAt)
            .ToListAsync(cancellationToken);

        return classes.Select(c => new ClassResponse(
            c.Id,
            c.Name,
            c.TotalSeats,
            c.HeldSeats,
            c.ConfirmedSeats,
            c.TotalSeats - c.HeldSeats - c.ConfirmedSeats
        )).ToList();
    }

    public async Task<ClassResponse> GetClassByIdAsync(string classId, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;

        var classItem = await _context.AdmissionClasses
            .AsNoTracking()
            .Where(c => c.Id == classId)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.TotalSeats,
                HeldSeats = c.Holds.Count(h => h.Status == HoldStatus.HELD && h.ExpiresAt > now),
                ConfirmedSeats = c.Holds.Count(h => h.Status == HoldStatus.CONFIRMED)
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (classItem == null)
        {
            throw new NotFoundException($"Class with ID '{classId}' was not found.");
        }

        return new ClassResponse(
            classItem.Id,
            classItem.Name,
            classItem.TotalSeats,
            classItem.HeldSeats,
            classItem.ConfirmedSeats,
            classItem.TotalSeats - classItem.HeldSeats - classItem.ConfirmedSeats
        );
    }
}
