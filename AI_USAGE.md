# AI Usage Disclosure

## 1. AI Tools Used
- **Antigravity (Google DeepMind)**: Assisted as an autonomous pair programmer to design, implement, test, containerize, and verify the entire School Admission System according to `ANTIGRAVITY_IMPLEMENTATION_PLAN.md`.

## 2. Areas Assisted
- **Monorepo Architecture & Scaffolding**: Setup of .NET 8 Web API, React 18 TypeScript Vite frontend, Docker Compose orchestration, and solution structure.
- **Database Design & Concurrency Strategy**: Formulated PostgreSQL row-level locking (`SELECT ... FOR UPDATE`), transaction boundaries, database check constraints, and partial unique indexes to guarantee capacity invariants across multiple instances.
- **Exact Contract Adherence**: Matched all eight documented endpoints, routes, headers (`X-Student-Id`), response shapes, and HTTP status codes (`201`, `200`, `204`, `400`, `403`, `404`, `409`).
- **Background Worker**: Designed `ExpiredHoldWorker` to sweep and persist overdue holds every 2 seconds.
- **Automated Testing Suite**: Implemented 10 xUnit integration tests with real PostgreSQL, including a 40-thread concurrency test asserting zero overbooking.
- **Frontend Architecture**: Implemented React components for guardian admission, live countdown, simulated payment confirmation, and demo admin class management.
- **Docker Compose**: Authored multi-stage Dockerfiles and root `docker-compose.yml` with health checks and persistent storage.

## 3. Mistakes / Obstacles Encountered & How Corrected
1. **Directory Path with `#`**: The workspace folder name contained `#` (`C# ,NET`), which caused Vite/Rollup and Vitest module resolution issues on the host filesystem because `#` was treated as a URL fragment. This was resolved by using explicit TypeScript file extensions in imports and configuring paths properly.
2. **Vitest Version Compatibility**: Attempting to install the latest Vitest 5 pulled in dependencies expecting Vite 6+, which collided with the React template's Vite 5. Fixed by pinning to Vitest 2.1.8.
3. **Database Concurrency under Multi-Instance**: In-memory C# locks would fail across separate API processes. Resolved by serializing transactions at the PostgreSQL database row level using `SELECT ... FOR UPDATE`.

## 4. Verification & Review
Every single component was built, executed, and verified live:
- 10 automated backend tests passed.
- 40 simultaneous parallel requests concurrency test passed.
- 2 independent backend instances running on separate ports (8080 and 8081) concurrently hit the database with 40 requests, confirming row-level locking coordinates across separate processes.
- Full `docker compose down` and `docker compose up` cycle executed, confirming data persistence in PostgreSQL.
