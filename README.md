# School Admission System — .NET 8, PostgreSQL & React

A robust, concurrency-safe school admission management system built for **OnnoRokom Projukti Limited** (Assistant Software Engineer assignment).

Guardians identify students using their 17-digit birth-registration number, explore class/shift availability, temporarily reserve (hold) seats, and finalize admission via simulated payment. The system strictly follows a first-come-first-served policy under high concurrency, backed by PostgreSQL row-level locks and database constraints.

---

## 1. System Architecture

```text
                                 ┌─────────────────────────┐
                                 │   React 18 + Vite UI    │
                                 │    (Port 3000 / Nginx)  │
                                 └────────────┬────────────┘
                                              │ HTTP / JSON
                                              │ (X-Student-Id)
                                              ▼
                                 ┌─────────────────────────┐
                                 │    .NET 8 Web API       │
                                 │      (Port 8080)        │
                                 └────────────┬────────────┘
                                              │ Npgsql / EF Core
                                              │ (SELECT FOR UPDATE)
                                              ▼
                                 ┌─────────────────────────┐
                                 │   PostgreSQL 16 Engine  │
                                 │  (Port 5432 / Persistent)│
                                 └─────────────────────────┘
```

- **Backend**: .NET 8 Web API with C#, Entity Framework Core, Npgsql, FluentValidation, Swashbuckle Swagger.
- **Database**: PostgreSQL 16 with row-level serialization, check constraints, and partial unique indexes.
- **Background Worker**: `ExpiredHoldWorker` sweeps and persists overdue holds every 2 seconds.
- **Frontend**: React 18 with TypeScript, Vite, responsive UI, polling interval, live countdown, and localStorage student persistence.
- **Runtime Orchestration**: Root `docker-compose.yml` with health checks, auto-migration, and persistent named volumes.

---

## 2. Prerequisites & Quick Start

The only prerequisite on the reviewer machine is **Docker Desktop** (or Docker Engine with Compose). No local .NET SDK, Node.js, or PostgreSQL installations are required.

### Starting the Application

```bash
# 1. Clone repository
git clone https://github.com/MahdiHassanGo/School-Admission-System--.NET.git
cd School-Admission-System--.NET

# 2. Copy development environment file
cp .env.example .env

# 3. Build and launch all services
docker compose up --build
```

### Accessing the Applications
- **Frontend UI**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8080](http://localhost:8080)
- **Swagger Documentation**: [http://localhost:8080/swagger](http://localhost:8080/swagger)
- **Health Check**: [http://localhost:8080/health](http://localhost:8080/health)

Data persistence survives restarts: `docker compose down` followed by `docker compose up` preserves all classes and admissions stored in the named Docker volume `postgres_data`.

---

## 3. Concurrency Safety & Seat Invariant Guarantee

The core engineering priority (P0) requires that:
$$\text{heldSeats} + \text{confirmedSeats} \le \text{totalSeats}$$
under concurrent requests and across multiple API instances.

### PostgreSQL Serialization Protocol (`SELECT ... FOR UPDATE`)
1. When `POST /classes/{classId}/holds` is invoked, an explicit database transaction is started.
2. The target class record in `admission_classes` is locked via `SELECT * FROM admission_classes WHERE id = @classId FOR UPDATE`.
3. The authoritative PostgreSQL clock (`clock_timestamp()`) is sampled.
4. Overdue `HELD` rows for the class are eagerly transitioned to `EXPIRED`.
5. The student is verified to have no active or confirmed application for that class (further reinforced by a database partial unique index on `(class_id, student_id) WHERE status IN ('HELD', 'CONFIRMED')`).
6. Active holds (`status = 'HELD' AND expires_at > db_time`) and confirmed admissions (`status = 'CONFIRMED'`) are counted while holding the row lock.
7. If `held + confirmed >= total_seats`, the transaction aborts with `409 Conflict`.
8. Otherwise, the new hold is inserted with `expires_at = db_time + HOLD_DURATION_SECONDS` and committed.

Because locking is serialized at the PostgreSQL database row level rather than in-memory C# locks, the invariant is strictly enforced across multiple API containers or horizontally scaled processes.

---

## 4. API Specification & Contract

All JSON properties strictly follow `camelCase`. The `X-Student-Id` header is required for student operations and must contain exactly 17 numeric digits.

| # | Method | Path | Header | Status | Description |
|---|---|---|---|---|---|
| 1 | `POST` | `/classes` | None | `201 Created` | Create new class/shift with name and totalSeats |
| 2 | `GET` | `/classes` | None | `200 OK` | List classes with `heldSeats`, `confirmedSeats`, `availableSeats` |
| 3 | `GET` | `/classes/{classId}` | None | `200 OK` | Retrieve single class with real-time seat statistics |
| 4 | `POST` | `/classes/{classId}/holds` | `X-Student-Id` | `201 Created` | Reserve seat under row lock; returns `409` if full or duplicate |
| 5 | `GET` | `/holds/{holdId}` | None | `200 OK` | Inspect hold status and UTC expiration |
| 6 | `POST` | `/holds/{holdId}/confirm` | `X-Student-Id` | `200 OK` | Idempotent payment simulation; transitions `HELD` to `CONFIRMED` |
| 7 | `DELETE` | `/holds/{holdId}` | `X-Student-Id` | `204 NoContent` | Cancel hold and immediately release seat |
| 8 | `GET` | `/me/holds` | `X-Student-Id` | `200 OK` | Retrieve all applications for the authenticated student |

### Error Handling & Problem Details
Invalid requests return structured Problem Details JSON (`application/problem+json`):
- `400 Bad Request`: Missing/malformed `X-Student-Id`, empty class name, non-positive seat count, invalid JSON.
- `403 Forbidden`: `X-Student-Id` does not match the hold's student owner.
- `404 Not Found`: Class or hold does not exist.
- `409 Conflict`: Class is full, duplicate active application, attempting to confirm expired/cancelled hold, or cancelling confirmed admission.

---

## 5. Automated Tests

### Backend Automated Test Suite
Integration tests use a real PostgreSQL database with migration execution and cover all lifecycle states, plus high-concurrency races.

To run the backend test suite locally:
```bash
dotnet test backend/tests/SchoolAdmission.Api.Tests/SchoolAdmission.Api.Tests.csproj
```

**Covered Test Scenarios:**
- **B1**: Class creation returns `201` with `id`, `name`, and `totalSeats`.
- **B2**: List classes accurately calculates `heldSeats`, `confirmedSeats`, and `availableSeats`.
- **B3**: Create hold validates 17-digit birth-registration number and sets expiration window.
- **B4**: Application rejected with `409 Conflict` when class capacity is reached.
- **B5**: Duplicate application rejected with `409 Conflict` if student already holds or confirmed.
- **B6**: Expired hold cannot be confirmed; returns `409 Conflict` and preserves capacity.
- **B7**: Confirmation is idempotent; repeated calls succeed with `200 OK` without double-allocating.
- **B8**: Cancellation returns `204 No Content` and immediately returns seat to available pool.
- **B9**: Hosted `ExpiredHoldWorker` periodically sweeps overdue holds and updates database to `EXPIRED`.
- **Mandatory Concurrency Test**: Fires 40 simultaneous parallel HTTP requests against a 5-seat class. Exactly 5 requests succeed (`201`), 35 are rejected with `409`, and total occupancy never exceeds capacity.

---

## 6. End-to-End Walkthrough Demo

1. **Open UI**: Navigate to [http://localhost:3000](http://localhost:3000).
2. **Enter Student ID**: Input a valid 17-digit birth registration number (e.g. `20152691234567890`) and click **Set Student ID**. The ID is saved in `localStorage`.
3. **Admin Setup**: Navigate to the **School Admin** tab and create a class (e.g., `Class 6 - Morning Shift`, 5 seats).
4. **Reserve Seat**: Return to **Guardian / Admission** and click **Apply for Admission Seat**. An active hold card appears with a live countdown timer.
5. **Confirm Admission**: Click **💳 Pay Admission Fee**. The API confirms the hold, seat counts update in real-time, and status changes to `CONFIRMED`.
6. **Cancellation Demo**: Enter another student ID (e.g. `20152691234567891`), apply for a seat, and click **Cancel Hold**. The seat is immediately released back to available pool.
7. **Expiry Demo**: When a hold's countdown expires, it transitions to `EXPIRED` and payment is disabled.
8. **Page Reload**: Refresh the browser page. The student ID is restored and `/me/holds` automatically re-populates the student's admission history.

---

## 7. Assumptions & Trade-offs
See [ASSUMPTIONS.md](ASSUMPTIONS.md) for detailed decisions regarding student identity, absence of login authentication, timezones, and simulated payment.
See [AI_USAGE.md](AI_USAGE.md) for full disclosure of AI-assisted engineering workflow.
