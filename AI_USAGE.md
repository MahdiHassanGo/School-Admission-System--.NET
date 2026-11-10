# AI Usage Disclosure

This document discloses the AI tools used during the development and
review of the School Admission System, the areas in which they assisted,
the issues encountered, and the verification evidence available at the
time of this update.

## 1. AI tools used

-   **Antigravity (Google DeepMind):** Used as an AI-assisted
    pair-programming tool for architecture planning, scaffolding,
    implementation, testing, and Docker configuration.
-   **ChatGPT (OpenAI):** Used for explaining Docker and container
    concepts, interpreting terminal output, troubleshooting the local
    Vite/Vitest path and test-environment issues, reviewing project
    readiness, and preparing/revising project documentation.

AI assistance did not replace the developer's responsibility to review
the implementation, run commands locally, inspect test output, and
decide which changes to apply.

## 2. Areas where AI assistance was used

### Architecture and project scaffolding

-   Planning the .NET 8 Web API, React 18 TypeScript frontend,
    PostgreSQL database, and monorepo structure.
-   Planning Dockerfiles and Docker Compose orchestration for the
    frontend, backend, and database.

### Backend and database design

-   Assistance with Entity Framework Core and PostgreSQL schema design.
-   Planning transaction boundaries and PostgreSQL row-level locking
    with `SELECT ... FOR UPDATE`.
-   Planning database constraints and a partial unique index to prevent
    duplicate active/confirmed applications.
-   Planning the background worker that expires overdue holds.

### API contract

-   Assistance in aligning the eight API endpoints, request headers,
    response shapes, and expected HTTP status codes with the assignment.

### Frontend

-   Assistance with the guardian admission flow, class/shift
    availability, hold countdown, simulated payment confirmation,
    application history, and demonstration admin interface.
-   Assistance with Vitest and React Testing Library test setup.

### Testing and documentation

-   Assistance with backend and frontend test planning.
-   Review of local build, test, Docker, and health-check output.
-   Preparation and revision of `README.md`, `ASSUMPTIONS.md`, and this
    disclosure.

## 3. Development issues encountered and resolutions

### 3.1 Local project path containing `#`

The original local workspace directory was named `C# ,NET`. Vite/Vitest
warned that `#` in the project path could be interpreted as a URL
fragment. The test run then failed to resolve Vite's `/@vite/env`
module.

**Resolution:** The local project directory was renamed to `CSharp_NET`.
After the rename, Vite no longer displayed the path warning and the
frontend test suite ran successfully.

### 3.2 Missing frontend test environment dependency

Vitest initially reported that it could not find `happy-dom`.

**Resolution:** `happy-dom` was added as a frontend development
dependency. The installed version reported by `npm ls` was
`happy-dom@21.0.4`. After correcting the project path, the frontend test
suite completed with all five tests passing.

### 3.3 Concurrency and seat allocation

Process-local locks would not coordinate capacity decisions across
separate API processes.

**Resolution:** The implementation uses PostgreSQL transactions and
row-level locking on the relevant admission-class row. A partial unique
index provides additional protection against duplicate active/confirmed
applications. The backend test suite includes a concurrent-request
scenario.

### 3.4 Docker service orchestration

The application requires a frontend, backend, and database to start in
the correct order.

**Resolution:** Docker Compose defines the three services, PostgreSQL
health checking, backend startup after database readiness, and a named
database volume. The frontend production build is served by Nginx.

## 4. Verification evidence

The following results were reported from local commands run by the
developer.

  Verification                                Latest reported result
  ------------------------------------------- ---------------------------------
  Backend xUnit tests                         10 passed, 0 failed, 0 skipped
  Frontend Vitest tests                       5 passed, 0 failed
  Frontend TypeScript/Vite production build   Passed
  Docker backend image build                  Passed
  Docker frontend image build                 Passed
  PostgreSQL container health                 Healthy
  Backend container startup                   Started
  Frontend container startup                  Started
  Backend `/health` endpoint                  Returned `{"status":"healthy"}`

### Backend test result

``` text
Passed!  - Failed: 0, Passed: 10, Skipped: 0, Total: 10
```

The backend suite includes a concurrency scenario with 40 simultaneous
requests competing for 5 seats. The reported expected outcome is 5
successful reservations and 35 conflict responses, without exceeding
class capacity.

### Frontend test result

``` text
Test Files  1 passed (1)
Tests       5 passed (5)
```

The five tests cover: 1. Rendering classes and live seat counts. 2.
Creating a hold for a valid student and displaying `HELD`. 3. Disabling
payment for an expired hold. 4. Showing a readable notification for a
`409 Conflict` response. 5. Restoring the student ID from `localStorage`
and querying applications.

### Docker and health-check result

The latest Docker run successfully built the backend and frontend
images, created the Compose network and named database volume, started
all three containers, and reported PostgreSQL as healthy.

The following command returned a healthy response:

``` bash
curl http://localhost:8080/health
```

``` json
{
  "status": "healthy"
}
```

## 5. Checks still to be completed

The latest terminal evidence does not establish that the following
manual checks have been completed after the local directory rename:

-   Full browser walkthrough: create a class, apply for admission,
    confirm simulated payment, cancel a hold, and inspect My
    Applications.
-   Verify that existing class and application records survive a
    `docker compose down` followed by `docker compose up -d` using the
    current Compose project name and volume.
-   Run and review ESLint using `npm run lint`.
-   Review the npm audit report. An earlier npm installation reported 13
    dependency advisories (10 moderate, 1 high, and 2 critical). No
    claim is made here that these advisories have been resolved.

The original workspace directory was renamed, and the latest Docker run
created a new project-prefixed volume named `csharp_net_postgres_data`.
Persistence should therefore be checked against the volume used by the
current Compose project.

## 6. Developer responsibility

AI-generated suggestions and code were subject to developer review. The
developer ran the reported build, test, Docker, and health-check
commands locally and is responsible for the final submitted source code,
configuration, documentation, and verification.
