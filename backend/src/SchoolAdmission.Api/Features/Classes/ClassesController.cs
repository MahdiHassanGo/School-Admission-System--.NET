using Microsoft.AspNetCore.Mvc;

namespace SchoolAdmission.Api.Features.Classes;

[ApiController]
[Route("classes")]
public class ClassesController : ControllerBase
{
    private readonly IClassService _classService;

    public ClassesController(IClassService classService)
    {
        _classService = classService;
    }

    [HttpPost]
    [ProducesResponseType(typeof(CreateClassResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateClass([FromBody] CreateClassRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = string.Join("; ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage));
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Validation Error",
                Detail = errors,
                Instance = HttpContext.Request.Path
            });
        }

        var result = await _classService.CreateClassAsync(request, cancellationToken);
        return Created($"/classes/{result.Id}", result);
    }

    [HttpGet]
    [ProducesResponseType(typeof(List<ClassResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetClasses(CancellationToken cancellationToken)
    {
        var result = await _classService.GetClassesAsync(cancellationToken);
        return Ok(result);
    }

    [HttpGet("{classId}")]
    [ProducesResponseType(typeof(ClassResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetClassById(string classId, CancellationToken cancellationToken)
    {
        var result = await _classService.GetClassByIdAsync(classId, cancellationToken);
        return Ok(result);
    }
}
