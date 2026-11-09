using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SchoolAdmission.Api.Infrastructure;
using Testcontainers.PostgreSql;
using Xunit;

namespace SchoolAdmission.Api.Tests;

public class TestFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    private PostgreSqlContainer? _dbContainer;
    private string _connectionString = string.Empty;

    public async Task InitializeAsync()
    {
        try
        {
            _dbContainer = new PostgreSqlBuilder()
                .WithImage("postgres:16-alpine")
                .WithDatabase($"test_{Guid.NewGuid():N}")
                .WithUsername("postgres")
                .WithPassword("postgres_dev_password")
                .Build();

            await _dbContainer.StartAsync();
            _connectionString = _dbContainer.GetConnectionString();
        }
        catch
        {
            // Fallback to running local PostgreSQL container
            _connectionString = $"Host=localhost;Port=5432;Database=test_{Guid.NewGuid():N};Username=postgres;Password=postgres_dev_password";
            
            // Create database if not exists
            using var masterConnection = new Npgsql.NpgsqlConnection("Host=localhost;Port=5432;Database=postgres;Username=postgres;Password=postgres_dev_password");
            await masterConnection.OpenAsync();
            var dbName = _connectionString.Split("Database=")[1].Split(";")[0];
            using var cmd = masterConnection.CreateCommand();
            cmd.CommandText = $"CREATE DATABASE \"{dbName}\"";
            await cmd.ExecuteNonQueryAsync();
        }

        // Run migrations
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
    }

    public new async Task DisposeAsync()
    {
        if (_dbContainer != null)
        {
            await _dbContainer.DisposeAsync();
        }
        else if (!string.IsNullOrEmpty(_connectionString) && _connectionString.Contains("test_"))
        {
            try
            {
                var dbName = _connectionString.Split("Database=")[1].Split(";")[0];
                using var masterConnection = new Npgsql.NpgsqlConnection("Host=localhost;Port=5432;Database=postgres;Username=postgres;Password=postgres_dev_password");
                await masterConnection.OpenAsync();
                using var cmd = masterConnection.CreateCommand();
                cmd.CommandText = $"DROP DATABASE IF EXISTS \"{dbName}\" WITH (FORCE)";
                await cmd.ExecuteNonQueryAsync();
            }
            catch
            {
                // ignore cleanup errors
            }
        }
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));
            if (descriptor != null)
            {
                services.Remove(descriptor);
            }

            services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(_connectionString));
        });

        builder.UseSetting("HOLD_DURATION_SECONDS", "3");
    }
}
