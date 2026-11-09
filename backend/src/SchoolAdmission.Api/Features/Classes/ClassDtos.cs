using System.ComponentModel.DataAnnotations;

namespace SchoolAdmission.Api.Features.Classes;

public record CreateClassRequest(
    [Required(ErrorMessage = "Class name is required.")]
    [StringLength(255, MinimumLength = 1, ErrorMessage = "Class name must be between 1 and 255 characters.")]
    string Name,

    [Range(1, int.MaxValue, ErrorMessage = "Total seats must be greater than zero.")]
    int TotalSeats
);

public record CreateClassResponse(
    string Id,
    string Name,
    int TotalSeats
);

public record ClassResponse(
    string Id,
    string Name,
    int TotalSeats,
    int HeldSeats,
    int ConfirmedSeats,
    int AvailableSeats
);
