# Assumptions and Architecture Decisions --- School Admission System

This document records the assumptions and technical decisions used to
implement the School Admission System assignment. These decisions keep
the implementation within the assignment's required scope.

------------------------------------------------------------------------

## 1. Class and shift identity

Each class/shift combination is an independent admission unit.

Examples: - `Class 6 - Morning Shift` - `Class 6 - Day Shift` -
`Class 7 - Morning Shift`

Each offering is stored as its own record in `admission_classes` and has
its own `total_seats` capacity. Creating or changing one offering does
not change another offering's capacity.

## 2. Student identity and authentication

The assignment does not require user registration, JWT authentication,
or session-based authentication.

A student's 17-digit birth-registration number is used as the student
identifier. Student-specific API requests pass this value in the
`X-Student-Id` HTTP header.

The header is used by: - `POST /classes/{classId}/holds` -
`POST /holds/{holdId}/confirm` - `DELETE /holds/{holdId}` -
`GET /me/holds`

This is an assignment-level identification mechanism, not secure proof
of identity or production-grade authentication.

## 3. Student ID validation

The backend validates that a student ID contains exactly 17 numeric
digits.

-   Empty values are rejected.
-   Non-numeric values are rejected.
-   Values with fewer or more than 17 digits are rejected.
-   Invalid values return `400 Bad Request`.

The frontend also validates the input to provide immediate feedback, but
server-side validation remains authoritative.

## 4. One active or confirmed application per student per class

A student may have at most one active or confirmed application for the
same class/shift.

The implementation enforces this through: - Transactional checks when
creating a hold. - A PostgreSQL partial unique index on
`(class_id, student_id)` for rows whose status is `HELD` or `CONFIRMED`.

If a previous application for that class is `EXPIRED` or `CANCELLED`,
the student may apply again if capacity is available.

## 5. Seat capacity and concurrent requests

The required capacity invariant is:

\[ `\text{heldSeats}`{=tex} + `\text{confirmedSeats}`{=tex}
`\leq `{=tex}`\text{totalSeats}`{=tex} \]

Each hold-creation operation uses a PostgreSQL transaction and locks the
relevant `admission_classes` row with `SELECT ... FOR UPDATE`.

While holding the row lock, the backend: 1. Evaluates overdue holds. 2.
Checks for an existing active or confirmed application by the same
student. 3. Counts active holds and confirmed admissions. 4. Rejects the
request with `409 Conflict` if capacity is full. 5. Creates the hold if
a seat is available.

The database row lock serializes capacity decisions for the same
class/shift and protects against overbooking across concurrent API
requests. The partial unique index provides additional protection
against duplicate active/confirmed applications.

The implementation does not maintain a separate explicit FIFO queue. For
requests arriving at effectively the same time, the order in which
PostgreSQL grants the row lock determines the order in which the
capacity decisions are processed.

Process-local C# locks or semaphores are not used as the authority for
seat allocation because they do not coordinate separate API processes.

## 6. Database clock and timestamps

The database clock is the authoritative time source for expiry and
capacity decisions. This avoids relying on potentially different clocks
across application instances.

Timestamps are stored in PostgreSQL using timezone-aware UTC values
(`timestamptz`) and are returned as ISO-8601 UTC timestamps. The browser
converts timestamps to local time for display.

## 7. Hold duration and expiration

The default hold duration is 600 seconds (10 minutes).

The duration is configurable through:

``` env
HOLD_DURATION_SECONDS=600
```

A hold: - Starts with status `HELD`. - Has an expiry timestamp. - Cannot
be confirmed after it expires. - Transitions to `EXPIRED` when its
expiry time has passed.

Expiry is evaluated during relevant seat-count and confirmation
operations. The hosted `ExpiredHoldWorker` also periodically updates
overdue `HELD` records to `EXPIRED` in PostgreSQL. The implementation is
configured to run this background sweep every few seconds (2 seconds in
the current implementation notes).

An expired hold cannot be revived. An attempt to confirm it returns
`409 Conflict`.

## 8. Simulated payment

The assignment does not require integration with a real payment gateway.

Clicking **Pay Admission Fee** invokes:

``` http
POST /holds/{holdId}/confirm
X-Student-Id: <17-digit-student-id>
```

If the hold is still active and belongs to the supplied student ID, the
backend changes its status to `CONFIRMED`, records the confirmation
timestamp, and returns `200 OK`.

No real payment is collected or transferred.

## 9. Idempotent confirmation

Confirming an already `CONFIRMED` hold again for the same student
returns a successful response with the existing confirmed status.

Repeated confirmation must not allocate another seat or increment the
confirmed-seat count a second time.

## 10. Cancellation

A student may cancel their own active `HELD` application by calling:

``` http
DELETE /holds/{holdId}
X-Student-Id: <17-digit-student-id>
```

A successful cancellation changes the status to `CANCELLED` and releases
the seat. The API returns `204 No Content`.

A confirmed admission cannot be cancelled through this hold-cancellation
operation; the API returns `409 Conflict`.

## 11. Administrative interface

The assignment does not provide an admin authentication endpoint or
require admin login.

The Class Management UI therefore operates in an open demonstration
mode. It allows a reviewer to: - Create a class/shift. - Specify its
seat capacity. - View class/shift offerings. - View total, held,
confirmed, and available seats.

This interface is not intended to represent a production-secure
administrative system.

## 12. Browser persistence of student identifier

The frontend stores the entered student ID in browser `localStorage` so
that the same browser can restore the identifier after refresh and
request the student's application list again.

Because the assignment does not include authentication, this browser
storage is a convenience for the demonstration and must not be treated
as secure authentication.

## 13. Database persistence and Docker volume

PostgreSQL uses a named Docker volume so that database data can survive
container removal and recreation.

Running:

``` bash
docker compose down
docker compose up -d
```

from the same project directory and with the same Compose project name
should reuse the same named volume.

Running:

``` bash
docker compose down -v
```

removes the named volume and its database data.

Docker Compose may prefix the declared volume name with the project
name. Renaming the project directory can change the Compose project name
and cause Compose to create a new prefixed volume. The previous volume
may remain in Docker but will not automatically be attached to the newly
named project.

## 14. API error handling

The API uses consistent HTTP status codes for expected outcomes:

-   `400 Bad Request`: invalid input or malformed student ID.
-   `403 Forbidden`: supplied student ID does not own the hold.
-   `404 Not Found`: class or hold does not exist.
-   `409 Conflict`: no seat available, duplicate active/confirmed
    application, invalid confirmation state, or cancellation of a
    confirmed admission.

The frontend displays understandable error messages for API failures
rather than relying only on browser console output.

## 15. Testing assumptions

The backend test suite uses xUnit and PostgreSQL-backed integration
tests. The reported suite contains 10 tests and includes a concurrency
scenario in which 40 simultaneous requests compete for 5 seats.

The frontend test suite uses Vitest and React Testing Library. The
reported suite contains five tests covering class listing, hold
creation, expired-hold behavior, API conflict handling, and restoration
of the student ID from `localStorage`.

Automated tests do not replace the manual browser walkthrough. The
manual admission workflow and persistence check should be completed
before final submission.

## 16. Scope limitations

The following features are intentionally outside the assignment scope: -
User registration and login. - JWT or session authentication. - Secure
admin roles and permissions. - Real payment gateway integration. -
Unrelated school modules such as attendance, examination results,
teacher management, or fee accounting.

These limitations keep the implementation focused on the required
admission workflow.
