using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Domain;

namespace SchoolAdmission.Api.Infrastructure;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<AdmissionClass> AdmissionClasses => Set<AdmissionClass>();
    public DbSet<AdmissionHold> AdmissionHolds => Set<AdmissionHold>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<AdmissionClass>(entity =>
        {
            entity.ToTable("admission_classes");

            entity.HasKey(c => c.Id);
            entity.Property(c => c.Id).HasColumnName("id");
            entity.Property(c => c.Name).HasColumnName("name").IsRequired().HasMaxLength(255);
            entity.Property(c => c.TotalSeats).HasColumnName("total_seats").IsRequired();
            entity.Property(c => c.CreatedAt).HasColumnName("created_at").HasColumnType("timestamptz").IsRequired();

            entity.ToTable(t => t.HasCheckConstraint("CK_admission_classes_total_seats", "total_seats > 0"));
        });

        modelBuilder.Entity<AdmissionHold>(entity =>
        {
            entity.ToTable("admission_holds");

            entity.HasKey(h => h.Id);
            entity.Property(h => h.Id).HasColumnName("id");
            entity.Property(h => h.ClassId).HasColumnName("class_id").IsRequired();
            entity.Property(h => h.StudentId).HasColumnName("student_id").IsRequired().HasMaxLength(17);
            entity.Property(h => h.Status)
                .HasColumnName("status")
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();
            entity.Property(h => h.CreatedAt).HasColumnName("created_at").HasColumnType("timestamptz").IsRequired();
            entity.Property(h => h.ExpiresAt).HasColumnName("expires_at").HasColumnType("timestamptz").IsRequired();
            entity.Property(h => h.ConfirmedAt).HasColumnName("confirmed_at").HasColumnType("timestamptz");
            entity.Property(h => h.CancelledAt).HasColumnName("cancelled_at").HasColumnType("timestamptz");

            entity.HasOne(h => h.Class)
                .WithMany(c => c.Holds)
                .HasForeignKey(h => h.ClassId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(h => new { h.ClassId, h.Status, h.ExpiresAt })
                .HasDatabaseName("ix_admission_holds_class_status_expires");

            entity.HasIndex(h => new { h.StudentId, h.CreatedAt })
                .HasDatabaseName("ix_admission_holds_student_created");

            entity.HasIndex(h => new { h.ClassId, h.StudentId })
                .IsUnique()
                .HasFilter("status IN ('HELD', 'CONFIRMED')")
                .HasDatabaseName("ux_admission_holds_class_student_active");

            entity.ToTable(t => t.HasCheckConstraint("CK_admission_holds_status", "status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')"));
        });
    }
}
