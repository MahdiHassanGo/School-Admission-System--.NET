namespace SchoolAdmission.Api.Domain;

public static class StudentIdValidator
{
    public static void Validate(string? studentId)
    {
        if (string.IsNullOrWhiteSpace(studentId))
        {
            throw new BadRequestException("Missing required 'X-Student-Id' header.");
        }

        var trimmed = studentId.Trim();
        if (trimmed.Length != 17 || !trimmed.All(char.IsDigit))
        {
            throw new BadRequestException("The 'X-Student-Id' header must contain exactly 17 numeric digits.");
        }
    }
}
