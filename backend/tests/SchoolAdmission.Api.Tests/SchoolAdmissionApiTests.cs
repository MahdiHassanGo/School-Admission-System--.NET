using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SchoolAdmission.Api.Domain;
using SchoolAdmission.Api.Features.Classes;
using SchoolAdmission.Api.Features.Holds;
using SchoolAdmission.Api.Infrastructure;
using Xunit;

namespace SchoolAdmission.Api.Tests;

public class SchoolAdmissionApiTests : IClassFixture<TestFixture>
{
    private readonly TestFixture _factory;
    private readonly HttpClient _client;

    public SchoolAdmissionApiTests(TestFixture factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task B1_CreateValidClass_Returns201WithExpectedFields()
    {
        // Arrange
        var request = new CreateClassRequest("Class 10 - Science Morning", 45);

        // Act
        var response = await _client.PostAsJsonAsync("/classes", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<CreateClassResponse>();
        created.Should().NotBeNull();
        created!.Id.Should().StartWith("c_");
        created.Name.Should().Be("Class 10 - Science Morning");
        created.TotalSeats.Should().Be(45);
    }

    [Fact]
    public async Task B2_ListClasses_ReturnsCorrectCounts()
    {
        // Arrange: create class with 10 seats
        var classRes = await _client.PostAsJsonAsync("/classes", new CreateClassRequest("Class 7 - Day Shift", 10));
        var createdClass = await classRes.Content.ReadFromJsonAsync<CreateClassResponse>();
        var classId = createdClass!.Id;

        // Hold seat 1
        var holdReq1 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq1.Headers.Add("X-Student-Id", "20152691234567801");
        var holdRes1 = await _client.SendAsync(holdReq1);
        holdRes1.StatusCode.Should().Be(HttpStatusCode.Created);

        // Hold seat 2 and confirm it
        var holdReq2 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq2.Headers.Add("X-Student-Id", "20152691234567802");
        var holdRes2 = await _client.SendAsync(holdReq2);
        holdRes2.StatusCode.Should().Be(HttpStatusCode.Created);
        var hold2 = await holdRes2.Content.ReadFromJsonAsync<CreateHoldResponse>();

        var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold2!.HoldId}/confirm");
        confirmReq.Headers.Add("X-Student-Id", "20152691234567802");
        var confirmRes = await _client.SendAsync(confirmReq);
        confirmRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // Act
        var getRes = await _client.GetAsync($"/classes/{classId}");

        // Assert
        getRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var classDetail = await getRes.Content.ReadFromJsonAsync<ClassResponse>();
        classDetail.Should().NotBeNull();
        classDetail!.TotalSeats.Should().Be(10);
        classDetail.HeldSeats.Should().Be(1);
        classDetail.ConfirmedSeats.Should().Be(1);
        classDetail.AvailableSeats.Should().Be(8);
    }

    [Fact]
    public async Task B3_CreateHold_WithValidStudentId_Returns201()
    {
        // Arrange
        var classRes = await _client.PostAsJsonAsync("/classes", new CreateClassRequest("Class 8 - Morning", 20));
        var createdClass = await classRes.Content.ReadFromJsonAsync<CreateClassResponse>();

        var request = new HttpRequestMessage(HttpMethod.Post, $"/classes/{createdClass!.Id}/holds");
        request.Headers.Add("X-Student-Id", "20152691234567803");

        // Act
        var response = await _client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var hold = await response.Content.ReadFromJsonAsync<CreateHoldResponse>();
        hold.Should().NotBeNull();
        hold!.HoldId.Should().StartWith("h_");
        hold.ClassId.Should().Be(createdClass.Id);
        hold.StudentId.Should().Be("20152691234567803");
        hold.Status.Should().Be("HELD");
        hold.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public async Task B4_ApplyWhenClassIsFull_Returns409Conflict()
    {
        // Arrange: class with only 1 seat
        var classRes = await _client.PostAsJsonAsync("/classes", new CreateClassRequest("Class 1 - Morning Full Test", 1));
        var createdClass = await classRes.Content.ReadFromJsonAsync<CreateClassResponse>();
        var classId = createdClass!.Id;

        // First hold succeeds
        var req1 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        req1.Headers.Add("X-Student-Id", "20152691234567804");
        var res1 = await _client.SendAsync(req1);
        res1.StatusCode.Should().Be(HttpStatusCode.Created);

        // Second hold must fail
        var req2 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        req2.Headers.Add("X-Student-Id", "20152691234567805");

        // Act
        var res2 = await _client.SendAsync(req2);

        // Assert
        res2.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task B5_SameStudentAppliesTwice_Returns409Conflict()
    {
        // Arrange
        var classRes = await _client.PostAsJsonAsync("/classes", new CreateClassRequest("Class 2 - Duplicate Test", 10));
        var createdClass = await classRes.Content.ReadFromJsonAsync<CreateClassResponse>();
        var classId = createdClass!.Id;

        var req1 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        req1.Headers.Add("X-Student-Id", "20152691234567806");
        var res1 = await _client.SendAsync(req1);
        res1.StatusCode.Should().Be(HttpStatusCode.Created);

        // Same student applies again to the same class
        var req2 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        req2.Headers.Add("X-Student-Id", "20152691234567806");

        // Act
        var res2 = await _client.SendAsync(req2);

        // Assert
        res2.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task B6_ConfirmExpiredHold_Returns409Conflict()
    {
        // Arrange
        var classRes = await _client.PostAsJsonAsync("/classes", new CreateClassRequest("Class 3 - Expiry Test", 5));
        var createdClass = await classRes.Content.ReadFromJsonAsync<CreateClassResponse>();
        var classId = createdClass!.Id;

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", "20152691234567807");
        var holdRes = await _client.SendAsync(holdReq);
        var hold = await holdRes.Content.ReadFromJsonAsync<CreateHoldResponse>();

        // Manually expire hold in DB to simulate immediate overdue state
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var dbHold = await db.AdmissionHolds.FirstAsync(h => h.Id == hold!.HoldId);
            dbHold.ExpiresAt = DateTime.UtcNow.AddSeconds(-10);
            await db.SaveChangesAsync();
        }

        // Act: try to confirm expired hold
        var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold!.HoldId}/confirm");
        confirmReq.Headers.Add("X-Student-Id", "20152691234567807");
        var confirmRes = await _client.SendAsync(confirmReq);

        // Assert
        confirmRes.StatusCode.Should().Be(HttpStatusCode.Conflict);

        // Verify hold remains unconfirmed
        var getHoldRes = await _client.GetAsync($"/holds/{hold.HoldId}");
        var holdDetail = await getHoldRes.Content.ReadFromJsonAsync<HoldDetailResponse>();
        holdDetail!.Status.Should().Be("EXPIRED");
    }

    [Fact]
    public async Task B7_DuplicateConfirmation_IsIdempotent()
    {
        // Arrange
        var classRes = await _client.PostAsJsonAsync("/classes", new CreateClassRequest("Class 4 - Idempotent Confirm", 5));
        var createdClass = await classRes.Content.ReadFromJsonAsync<CreateClassResponse>();
        var classId = createdClass!.Id;

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", "20152691234567808");
        var holdRes = await _client.SendAsync(holdReq);
        var hold = await holdRes.Content.ReadFromJsonAsync<CreateHoldResponse>();

        // Act 1: First confirm
        var confirmReq1 = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold!.HoldId}/confirm");
        confirmReq1.Headers.Add("X-Student-Id", "20152691234567808");
        var confirmRes1 = await _client.SendAsync(confirmReq1);
        confirmRes1.StatusCode.Should().Be(HttpStatusCode.OK);

        // Act 2: Second confirm
        var confirmReq2 = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold.HoldId}/confirm");
        confirmReq2.Headers.Add("X-Student-Id", "20152691234567808");
        var confirmRes2 = await _client.SendAsync(confirmReq2);
        confirmRes2.StatusCode.Should().Be(HttpStatusCode.OK);

        // Assert: Class confirmed count is strictly 1
        var classRes2 = await _client.GetAsync($"/classes/{classId}");
        var classDetail = await classRes2.Content.ReadFromJsonAsync<ClassResponse>();
        classDetail!.ConfirmedSeats.Should().Be(1);
        classDetail.HeldSeats.Should().Be(0);
        classDetail.AvailableSeats.Should().Be(4);
    }

    [Fact]
    public async Task B8_CancelHeldApplication_ReleasesSeat()
    {
        // Arrange
        var classRes = await _client.PostAsJsonAsync("/classes", new CreateClassRequest("Class 5 - Cancel Test", 2));
        var createdClass = await classRes.Content.ReadFromJsonAsync<CreateClassResponse>();
        var classId = createdClass!.Id;

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", "20152691234567809");
        var holdRes = await _client.SendAsync(holdReq);
        var hold = await holdRes.Content.ReadFromJsonAsync<CreateHoldResponse>();

        // Verify 1 held seat
        var beforeCancel = await (await _client.GetAsync($"/classes/{classId}")).Content.ReadFromJsonAsync<ClassResponse>();
        beforeCancel!.HeldSeats.Should().Be(1);
        beforeCancel.AvailableSeats.Should().Be(1);

        // Act: Cancel hold
        var deleteReq = new HttpRequestMessage(HttpMethod.Delete, $"/holds/{hold!.HoldId}");
        deleteReq.Headers.Add("X-Student-Id", "20152691234567809");
        var deleteRes = await _client.SendAsync(deleteReq);

        // Assert
        deleteRes.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify seat is released
        var afterCancel = await (await _client.GetAsync($"/classes/{classId}")).Content.ReadFromJsonAsync<ClassResponse>();
        afterCancel!.HeldSeats.Should().Be(0);
        afterCancel.AvailableSeats.Should().Be(2);
    }

    [Fact]
    public async Task B9_ExpiredHoldWorker_SweepsOverdueHolds()
    {
        // Arrange
        var classRes = await _client.PostAsJsonAsync("/classes", new CreateClassRequest("Class 9 - Worker Expiry Test", 5));
        var createdClass = await classRes.Content.ReadFromJsonAsync<CreateClassResponse>();
        var classId = createdClass!.Id;

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", "20152691234567810");
        var holdRes = await _client.SendAsync(holdReq);
        var hold = await holdRes.Content.ReadFromJsonAsync<CreateHoldResponse>();

        // Fast forward expiresAt in DB
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var dbHold = await db.AdmissionHolds.FirstAsync(h => h.Id == hold!.HoldId);
            dbHold.ExpiresAt = DateTime.UtcNow.AddSeconds(-5);
            await db.SaveChangesAsync();
        }

        // Wait for background worker sweep (interval is 2s)
        await Task.Delay(3000);

        // Assert: database status is EXPIRED
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var dbHold = await db.AdmissionHolds.AsNoTracking().FirstAsync(h => h.Id == hold!.HoldId);
            dbHold.Status.Should().Be(HoldStatus.EXPIRED);
        }
    }

    [Fact]
    public async Task MandatoryConcurrencyTest_40ParallelRequests_ExactlyCapacityAllocated()
    {
        // Arrange: 5 seats capacity
        const int capacity = 5;
        const int totalRequests = 40;

        var classRes = await _client.PostAsJsonAsync("/classes", new CreateClassRequest("Class Concurrency 101", capacity));
        var createdClass = await classRes.Content.ReadFromJsonAsync<CreateClassResponse>();
        var classId = createdClass!.Id;

        // Act: Fire 40 simultaneous parallel hold requests with unique 17-digit student IDs
        var tasks = Enumerable.Range(100, totalRequests).Select(async i =>
        {
            var studentId = $"20152691234567{i:D3}";
            var request = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
            request.Headers.Add("X-Student-Id", studentId);
            return await _client.SendAsync(request);
        }).ToArray();

        var responses = await Task.WhenAll(tasks);

        // Assert
        var successCount = responses.Count(r => r.StatusCode == HttpStatusCode.Created);
        var conflictCount = responses.Count(r => r.StatusCode == HttpStatusCode.Conflict);

        successCount.Should().Be(capacity, "exactly the number of available seats should be successfully held");
        conflictCount.Should().Be(totalRequests - capacity, "all excess requests must receive 409 Conflict");

        // Verify database state
        var classDetail = await (await _client.GetAsync($"/classes/{classId}")).Content.ReadFromJsonAsync<ClassResponse>();
        classDetail!.TotalSeats.Should().Be(capacity);
        classDetail.HeldSeats.Should().Be(capacity);
        classDetail.ConfirmedSeats.Should().Be(0);
        classDetail.AvailableSeats.Should().Be(0);

        // Verify total allocated seats invariant
        (classDetail.HeldSeats + classDetail.ConfirmedSeats).Should().BeLessOrEqualTo(classDetail.TotalSeats);
    }
}
