# AI Usage Disclosure

## Tools Used
- **Antigravity (Google DeepMind)**: Architecture planning, code implementation, test suite generation, and verification.

## Areas Assisted
- **Project Scaffolding**: Setup of .NET 8 Web API, React 18 TypeScript Vite frontend, Docker Compose orchestration, and monorepo structure.
- **Database & Concurrency Strategy**: Formulating PostgreSQL row-level locking (`SELECT ... FOR UPDATE`), transaction boundaries, and partial unique indexes to guarantee capacity invariants.
- **Contract Adherence**: Exact JSON schemas, route matching, HTTP status codes, and `X-Student-Id` header enforcement.
- **Testing**: Testcontainers integration for real PostgreSQL testing and xUnit multi-threaded concurrency tests.

## Verification & Manual Review
- All generated code, migrations, database constraints, and API contracts were inspected and verified against the specification.
- Real builds, unit/integration tests, and containerized Docker Compose setups were executed and passed.
