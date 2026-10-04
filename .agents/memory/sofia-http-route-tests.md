---
name: Sofia HTTP route tests
description: Test Sofia API routes over HTTP without using production storage.
---

For direct Sofia route HTTP tests, bundle the actual router into a temporary directory under `artifacts/api-server` instead of importing the TypeScript source with native Node ESM. The server relies on bundler resolution, and its `import.meta.url`-based data path expects the compiled artifact location. Route tests may need to map `@workspace/api-zod` to the generated schema entry.

**Why:** Native ESM could not resolve the server's extensionless imports, and importing source resolved `courses.json` from a nonexistent `src/data` directory, creating an unintended local SQLite file when no test DB path was set.

**How to apply:** Set `SOFIA_DB_PATH` to a fresh temporary SQLite file and unset `SOFIA_DATABASE_URL` before importing the bundle. Mount the router with Express cookie and JSON middleware, exercise it over localhost HTTP, and remove the temporary bundle and database during test cleanup.