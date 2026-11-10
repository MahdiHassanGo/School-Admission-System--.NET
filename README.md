# School Admission System --- .NET 8, PostgreSQL 16 & React 18

A school admission management system developed for the **OnnoRokom
Projukti Limited --- Assistant Software Engineer assignment**.

Guardians identify a student using a 17-digit birth-registration number,
view class/shift availability, temporarily reserve a seat, and confirm
admission through a simulated payment action. The backend protects seat
capacity using PostgreSQL transactions, row-level locking, and database
constraints.

> **Project status:** The latest locally reported checks are 10/10
> backend tests passed, 5/5 frontend tests passed, a successful frontend
> production build, successful Docker image builds, healthy PostgreSQL,
> and a healthy backend `/health` endpoint. The manual browser workflow
> and a fresh data-persistence check should still be completed before
> final submission.

------------------------------------------------------------------------

## 1. Features

### Guardian / student

-   Enter a 17-digit student birth-registration number.
-   View available class/shift offerings and seat counts.
-   Apply for an available seat.
-   Receive a temporary seat hold with an expiry countdown.
-   View the application status.
-   Confirm admission through simulated payment.
-   Cancel an active hold.
-   View the student's applications.

### School administrator

-   Create a class/shift with a name and total seat capacity.
-   View created offerings.
-   View total, held, confirmed, and available seats.

The administrative screen is an open demonstration interface because the
assignment does not require an admin authentication API.

### Admission rules

-   Each class/shift has its own independent seat capacity.
-   Admission allocation is processed through a PostgreSQL transaction.
-   A student cannot have more than one active or confirmed application
    for the same class/shift.
-   A hold expires after 600 seconds by default.
-   An expired hold cannot be confirmed.
-   A successful simulated payment changes the hold to `CONFIRMED`.
-   Cancelling an active hold releases the seat.

------------------------------------------------------------------------

## 2. System architecture

``` text
┌─────────────────────────────────────┐
│          Browser / User              │
│          localhost:3000              │
└──────────────────┬──────────────────┘
                   │ HTTP / JSON
                   ▼
┌─────────────────────────────────────┐
│       Frontend Docker container      │
│       React 18 + TypeScript + Vite   │
│       Nginx serves production files  │
│       Container port: 80             │
└──────────────────┬──────────────────┘
                   │ API requests
                   ▼
┌─────────────────────────────────────┐
│        Backend Docker container      │
│        ASP.NET Core Web API / .NET 8 │
│        Container port: 8080          │
└──────────────────┬──────────────────┘
                   │ EF Core / Npgsql
                   ▼
┌─────────────────────────────────────┐
│       PostgreSQL Docker container    │
│       PostgreSQL 16                  │
│       Container port: 5432           │
│       Named persistent volume        │
└─────────────────────────────────────┘
```

  -------------------------------------------------------------------------
  Service                 Technology              Host address
  ----------------------- ----------------------- -------------------------
  Frontend                React 18, TypeScript,   `http://localhost:3000`
                          Vite, Nginx             

  Backend                 ASP.NET Core Web API,   `http://localhost:8080`
                          .NET 8                  

  Database                PostgreSQL 16 Alpine    `localhost:5432`
  -------------------------------------------------------------------------

Docker Compose creates a private network for the services. The backend
connects to PostgreSQL using the Compose service hostname configured in
`docker-compose.yml`; it must not use `localhost` for the database
connection from inside the backend container.

### Technology stack

-   **Backend:** C#, ASP.NET Core Web API, .NET 8.
-   **ORM:** Entity Framework Core.
-   **PostgreSQL provider:** Npgsql.
-   **Database:** PostgreSQL 16.
-   **Frontend:** React 18, TypeScript, Vite.
-   **Frontend web server:** Nginx.
-   **Backend tests:** xUnit and PostgreSQL-backed integration tests.
-   **Frontend tests:** Vitest, React Testing Library, and `happy-dom`.
-   **Containerization:** Dockerfiles and Docker Compose.

------------------------------------------------------------------------

## 3. Prerequisites

### To run the complete application

The reviewer needs: - Docker Desktop, or Docker Engine with Docker
Compose. - Git, to clone the repository.

A local .NET SDK, Node.js installation, and PostgreSQL server are not
required to run the application through Docker.

### To run tests directly on the host

-   .NET 8 SDK for backend tests.
-   Node.js and npm compatible with the frontend project (the Docker
    build uses Node 20).

Use a local project directory without a `#` character. For example,
`School-Admission-System` or `CSharp_NET`. Vite/Vitest may interpret `#`
in a filesystem path as a URL fragment and fail to resolve modules
correctly.

------------------------------------------------------------------------

## 4. Quick start with Docker

### 4.1 Clone the repository

``` bash
git clone https://github.com/MahdiHassanGo/School-Admission-System--.NET.git School-Admission-System
cd School-Admission-System
```

The explicit destination folder avoids the `#` path issue encountered
during local development.

### 4.2 Configure environment variables

``` bash
cp .env.example .env
```

Review `.env` if you need to change local settings. Do not commit
secrets or a private `.env` file to GitHub.

The hold duration is configurable through:

``` env
HOLD_DURATION_SECONDS=600
```

The default is 600 seconds (10 minutes).

### 4.3 Build and start all services

``` bash
docker compose up --build
```

To run the services in the background:

``` bash
docker compose up --build -d
```

Docker Compose builds the backend and frontend images, starts
PostgreSQL, waits for the database health check, and then starts the
application services.

### 4.4 Check service status

``` bash
docker compose ps
```

Expected services: - `postgres` - `backend` - `frontend`

Check the backend health endpoint:

``` bash
curl http://localhost:8080/health
```

Expected response:

``` json
{
  "status": "healthy"
}
```

### 4.5 Open the application

-   **Frontend:** <http://localhost:3000>
-   **Backend:** <http://localhost:8080>
-   **Swagger (if enabled by the current environment):**
    <http://localhost:8080/swagger>
-   **Health check:** <http://localhost:8080/health>

### 4.6 Useful Docker commands

``` bash
# Start services in the background
docker compose up -d

# Rebuild images and start services
docker compose up --build -d

# Show service status
docker compose ps

# Follow logs from all services
docker compose logs -f

# Follow backend logs
docker compose logs -f backend

# Follow frontend logs
docker compose logs -f frontend

# Follow database logs
docker compose logs -f postgres

# Stop and remove containers and the Compose network
docker compose down
```

**Data warning:** `docker compose down` does not remove the named
database volume. `docker compose down -v` removes the named volume and
deletes the database data stored in it. Use `-v` only when intentionally
resetting the database.

Docker Compose prefixes named volumes with the Compose project name. The
latest local run created a volume named `csharp_net_postgres_data`; a
different clone folder or Compose project name may produce a different
prefixed volume name.

------------------------------------------------------------------------

## 5. Database and concurrency protection

The key capacity invariant is:

\[ `\text{heldSeats}`{=tex} + `\text{confirmedSeats}`{=tex}
`\leq `{=tex}`\text{totalSeats}`{=tex} \]

The backend uses a PostgreSQL transaction and locks the target
admission-class row with `SELECT ... FOR UPDATE` before checking and
allocating capacity.

The allocation process is:

1.  Begin a database transaction.
2.  Lock the target class/shift row.
3.  Read the authoritative database time.
4.  Expire overdue holds where required.
5.  Check whether the student already has an active or confirmed
    application for the same class.
6.  Count active holds and confirmed admissions.
7.  Return `409 Conflict` if no seat is available.
8.  Otherwise, create the hold and commit the transaction.

The row lock serializes capacity decisions for the same class/shift and
prevents concurrent requests from allocating more seats than the
configured capacity. The database partial unique index additionally
prevents duplicate active/confirmed applications for the same student
and class.

The implementation processes concurrent requests at the database
serialization point; it does not maintain a separate explicit FIFO queue
for simultaneous requests.

------------------------------------------------------------------------

## 6. API specification

Student-specific endpoints use the `X-Student-Id` header. The value must
contain exactly 17 numeric digits.

  -------------------------------------------------------------------------------------------------------
  \#          Method      Endpoint                     Header           Success response   Purpose
  ----------- ----------- ---------------------------- ---------------- ------------------ --------------
  1           `POST`      `/classes`                   None             `201 Created`      Create a
                                                                                           class/shift

  2           `GET`       `/classes`                   None             `200 OK`           List classes
                                                                                           and seat
                                                                                           statistics

  3           `GET`       `/classes/{classId}`         None             `200 OK`           Get one class
                                                                                           and its seat
                                                                                           statistics

  4           `POST`      `/classes/{classId}/holds`   `X-Student-Id`   `201 Created`      Create a
                                                                                           temporary seat
                                                                                           hold

  5           `GET`       `/holds/{holdId}`            None             `200 OK`           Get hold
                                                                                           details and
                                                                                           status

  6           `POST`      `/holds/{holdId}/confirm`    `X-Student-Id`   `200 OK`           Confirm a hold
                                                                                           through
                                                                                           simulated
                                                                                           payment

  7           `DELETE`    `/holds/{holdId}`            `X-Student-Id`   `204 No Content`   Cancel an
                                                                                           active hold

  8           `GET`       `/me/holds`                  `X-Student-Id`   `200 OK`           List
                                                                                           applications
                                                                                           for the
                                                                                           supplied
                                                                                           student ID
  -------------------------------------------------------------------------------------------------------

### Main error responses

-   `400 Bad Request`: Invalid input, missing or malformed student ID,
    blank class name, or non-positive seat count.
-   `403 Forbidden`: The supplied student ID does not own the hold.
-   `404 Not Found`: The requested class or hold does not exist.
-   `409 Conflict`: Class is full, duplicate active/confirmed
    application, expired/cancelled hold confirmation, or cancellation of
    a confirmed admission.

The student ID is an assignment-level identifier, not secure
authentication. The application does not implement user registration,
JWT, or session authentication.

------------------------------------------------------------------------

## 7. Automated tests

### 7.1 Backend tests

Run from the repository root:

``` bash
dotnet test backend/tests/SchoolAdmission.Api.Tests/SchoolAdmission.Api.Tests.csproj
```

The backend suite contains 10 tests. The reported successful run was:

``` text
Passed!  - Failed: 0, Passed: 10, Skipped: 0, Total: 10
```

The test suite covers: - Class creation and class listing. - Seat
availability calculations. - Student ID validation. - Hold creation and
expiration. - Full-capacity rejection. - Duplicate application
rejection. - Expired hold confirmation rejection. - Idempotent
confirmation. - Cancellation and seat release. - Background expiry
processing. - A concurrency scenario with 40 simultaneous requests
competing for 5 seats.

### 7.2 Frontend tests

Run from the frontend directory:

``` bash
cd frontend
npm ci
npm test
```

The frontend suite uses Vitest and React Testing Library. `happy-dom` is
included as a development dependency for the test environment.

The latest reported successful run was:

``` text
Test Files  1 passed (1)
Tests       5 passed (5)
```

The five frontend scenarios cover: 1. Rendering classes and live seat
counts. 2. Creating a hold for a valid student and displaying `HELD`. 3.
Disabling payment when a hold is expired. 4. Displaying a readable
notification for a `409 Conflict` API error. 5. Restoring the student ID
from `localStorage` and loading applications.

### 7.3 Frontend production build

Run from the frontend directory:

``` bash
npm run build
```

The latest reported build completed successfully using TypeScript
compilation and Vite production bundling.

### 7.4 Linting

The project defines an ESLint script:

``` bash
npm run lint
```

Run it before submission and review any warnings or errors. A successful
lint result has not been recorded in the latest verification log.

------------------------------------------------------------------------

## 8. Manual application walkthrough

Use sample IDs only. Do not use a real student's birth-registration
number in screenshots or demonstrations.

1.  Start the application with `docker compose up --build -d`.
2.  Open <http://localhost:3000>.
3.  Open the School Admin section.
4.  Create a class such as `Class 6 - Morning Shift` with 2 seats.
5.  Open Guardian / Admission.
6.  Enter a 17-digit sample student ID, for example `20152691234567890`.
7.  Apply for the class and verify that the application becomes `HELD`.
8.  Verify that the expiry countdown is displayed.
9.  Click **Pay Admission Fee** before expiry.
10. Verify that the status becomes `CONFIRMED` and the available-seat
    count decreases.
11. Use another sample ID, such as `20152691234567891`, to create
    another hold.
12. Cancel that active hold and verify that the seat becomes available
    again.
13. Open My Applications and verify the student's application history.
14. Refresh the browser and verify that the entered student ID is
    restored.

The payment action is simulated; no real payment gateway or money
transfer is involved.

------------------------------------------------------------------------

## 9. Database persistence verification

A named Docker volume is configured for PostgreSQL data.

To verify persistence:

1.  Start the application.

2.  Create a class and at least one application.

3.  Stop the stack:

    ``` bash
    docker compose down
    ```

4.  Start it again from the same project directory and with the same
    Compose project name:

    ``` bash
    docker compose up -d
    ```

5.  Open the application and verify that the class and application still
    exist.

Do not run `docker compose down -v` during this test.

Changing the project directory or Compose project name can change the
generated volume name. If that happens, Compose may create a new empty
volume instead of attaching the previous project's volume.

------------------------------------------------------------------------

## 10. Latest local verification record

Based on the development terminal output shared on 10 November 2026:

  -----------------------------------------------------------------------
  Check                               Reported result
  ----------------------------------- -----------------------------------
  Backend automated tests             10/10 passed

  Frontend automated tests            5/5 passed

  Frontend production build           Passed

  Docker backend image build          Passed

  Docker frontend image build         Passed

  PostgreSQL container                Healthy

  Backend container                   Started

  Frontend container                  Started

  Backend `/health` endpoint          Returned `{"status":"healthy"}`

  Manual browser admission workflow   Not yet recorded as completed

  Persistence check against the       Not yet recorded as completed
  volume created after the directory  
  rename                              

  ESLint run                          Not yet recorded as completed
  -----------------------------------------------------------------------

This table separates automated checks that have been demonstrated from
manual checks that remain to be performed.

------------------------------------------------------------------------

## 11. Important limitations and security notes

-   The admin interface is open for assignment demonstration; it is not
    protected by admin authentication.
-   The 17-digit student ID identifies a student for the assignment
    workflow but is not a secure authentication mechanism.
-   Payment is simulated. No real payment gateway is connected.
-   The project is designed to run locally through Docker Compose.
    Docker Compose alone does not publish the application to the public
    internet.
-   Use sample student IDs in demonstrations and screenshots.

------------------------------------------------------------------------

## 12. Related documentation

-   [ASSUMPTIONS.md](ASSUMPTIONS.md) --- assumptions and architecture
    decisions.
-   [AI_USAGE.md](AI_USAGE.md) --- AI assistance disclosure, development
    challenges, and verification record.
