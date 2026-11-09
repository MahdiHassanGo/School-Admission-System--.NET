# Assumptions and Architecture Decisions — School Admission System

## 1. Class / Shift Identity
Each class and shift combination (e.g., "Class 6 - Morning Shift", "Class 6 - Day Shift") is treated as an independent admission unit stored as its own record in `admission_classes` with its own `total_seats` capacity.

## 2. Student Identity & Authentication
Per the assignment specification, there is no user registration or JWT/session authentication mechanism. The student's 17-digit birth-registration number serves as their identity and is passed in the `X-Student-Id` HTTP header for student-scoped endpoints (`POST /classes/{classId}/holds`, `POST /holds/{holdId}/confirm`, `DELETE /holds/{holdId}`, `GET /me/holds`).

## 3. Student ID Validation
Student IDs are validated server-side to ensure they contain exactly 17 numeric digits (standard Bangladesh Birth Registration Number format). Empty, non-digit, or lengths other than 17 are rejected with `400 Bad Request`.

## 4. Single Active/Confirmed Application Per Class
A student can hold or confirm at most one seat per class/shift. Multiple applications to the same class by the same student are prevented by:
- Transactional checks inside `POST /classes/{classId}/holds`.
- A PostgreSQL partial unique index on `(class_id, student_id) WHERE status IN ('HELD', 'CONFIRMED')`.
If a student's prior hold for that class was `EXPIRED` or `CANCELLED`, they are eligible to apply again if seats remain.

## 5. First-Come-First-Served Under High Concurrency
To ensure `heldSeats + confirmedSeats <= totalSeats` strictly holds even under parallel requests across multiple API instances:
- Every hold creation initiates a PostgreSQL database transaction.
- The transaction executes `SELECT ... FOR UPDATE` on the target `admission_classes` row, establishing a serialized bottleneck at the database level.
- Database clock (`CURRENT_TIMESTAMP` / `clock_timestamp()`) is used to ensure server clock skew does not affect expiry or seat counts.
- Active held seats (`status = 'HELD' AND expires_at > current_db_time`) plus confirmed seats (`status = 'CONFIRMED'`) are counted while holding the row lock.
- If `occupied >= total_seats`, the transaction aborts with `409 Conflict`.
- Process-local locks (C# locks, Semaphores) are intentionally avoided for capacity decisions to support horizontal multi-instance scaling.

## 6. Hold Duration & Expiration
- Holds expire after `HOLD_DURATION_SECONDS` (default: 600 seconds, configurable via environment variable).
- Expiry is evaluated eagerly during seat-count calculations and hold confirmations based on `expires_at` in UTC.
- A hosted background service (`ExpiredHoldWorker`) periodically scans and transitions overdue `HELD` records to `EXPIRED` status in PostgreSQL every few seconds to keep persisted statuses synchronized.
- An expired hold can never be confirmed or revived; attempting to confirm an expired hold returns `409 Conflict`.

## 7. Simulated Payment
Clicking "Pay Admission Fee" simulates a successful payment. When the backend receives `POST /holds/{holdId}/confirm`, it verifies the hold is active, marks it `CONFIRMED`, records `confirmed_at`, and returns `200 OK`. No real payment gateway is integrated.

## 8. Idempotent Confirmation
If `POST /holds/{holdId}/confirm` is invoked on an already `CONFIRMED` hold by the same student, it returns `200 OK` with `{ "holdId": "...", "status": "CONFIRMED" }` without incrementing seat counts or altering timestamps. Simultaneous duplicate requests cannot double-confirm.

## 9. Cancellation
Students can cancel an active `HELD` application via `DELETE /holds/{holdId}` with matching `X-Student-Id`, transitioning the hold to `CANCELLED` and immediately releasing the seat (`204 No Content`). Attempting to cancel an already `CONFIRMED` admission returns `409 Conflict`.

## 10. Admin Interface
Since no administrative authentication endpoint is provided by the API specification, the Class Management UI operates in a demo/open administrative mode to allow creating classes and monitoring live seat statistics.

## 11. Timestamps & Timezones
All timestamps (`created_at`, `expires_at`, `confirmed_at`, `cancelled_at`) are stored as UTC in PostgreSQL (`timestamptz`) and transmitted as ISO-8601 UTC strings (`...Z`). The client converts these to local browser time for display.

## 12. Data Persistence
PostgreSQL runs with a named Docker volume (`postgres_data`) so that `docker compose down` followed by `docker compose up` preserves all classes, holds, and confirmed admissions.

## 13. Multi-Instance Concurrency
Because serialization occurs inside PostgreSQL row locks rather than in-memory process locks, multiple API instances (tested with two instances on separate ports sharing the same PostgreSQL database) coordinate allocation without overbooking or race conditions.
