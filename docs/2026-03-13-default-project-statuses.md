# Title
Project-Scoped Pending and Completed Status Defaults

# Context
A new requirement was introduced to guarantee that every project has the critical statuses Pending and Completed available by default, with strict project isolation for status records.

# Scope
- Move statuses from global scope to project scope.
- Ensure defaults are created idempotently per project.
- Keep status reads side-effect free (no implicit writes during queries).
- Allow full status management (including `Restricted`) without hardcoded blocking rules.

# Implementation Summary
- Updated the status model to include `projectId` and replaced global name uniqueness with compound uniqueness (`projectId` + `name`).
- Refactored status repository methods to require project scope:
	- `getAll(projectId)`
	- `getByIdInProject(id, projectId)`
	- `findByName(name, projectId)`
	- `ensureDefaultStatuses(projectId)`
- Removed read-side default insertion so query methods do not mutate data.
- Ensured default statuses are seeded during project creation and in seed flow using explicit project id context.
- Updated status CRUD server actions to enforce project ownership and project-local duplicate checks.
- Updated all status consumers (manage project, detail view, assignments, dashboard service) to pass project id.
- Added an operational backfill script for existing data:
	- `scripts/backfill-project-default-statuses.mjs`
	- dry-run by default, `--apply` to persist.
- Added npm commands:
	- `backfill:project-statuses:dry`
	- `backfill:project-statuses`

# Files Updated
- src/models/Status.ts
- src/constants/defaultStatuses.ts
- src/repositories/status.repository.ts
- src/repositories/project.repository.ts
- src/services/seed.service.ts
- src/app/manage-project/actions.ts
- src/app/manage-project/page.tsx
- src/app/detail/[floorId]/page.tsx
- src/app/assignments/actions.ts
- src/services/dashboard.service.ts
- scripts/backfill-project-default-statuses.mjs
- scripts/migrate-statuses-add-project-id.mjs
- package.json

# Validation
- npm run lint
- npx tsc --noEmit
- Result: passed without errors.

# Pending Work
- Run `npm run backfill:project-statuses:dry` in each target environment and then `npm run backfill:project-statuses` when the dry-run summary is correct.
- Optional data hygiene follow-up: remove legacy global status rows that have no `projectId` after verifying no references remain.

# Change Log
- 2026-03-13: Initial implementation of minimal default-status guarantee and status protection guardrails.
- 2026-03-13: Removed status blocking/protection rules and kept automatic default status insertion for legacy/global status collections.
- 2026-03-14: Refactored statuses to project scope, removed read-side write side effects, and added explicit backfill tooling for existing projects.
- 2026-03-13: Added explicit migration tooling to project-scope legacy statuses that still do not have `projectId`.
