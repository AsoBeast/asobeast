---
paths:
  - "apps/api/src/checklist/**"
  - "packages/shared/src/contracts/workspace-checklist.ts"
  - "apps/web/src/components/checklist/**"
---

# Workspace checklist rules

## Domain rule 27: The workspace checklist is derived on read; the workspace stores a goal and a dismissal

- `GET /workspace/checklist` (`apps/api/src/checklist/`) answers `buildChecklist` from `@asobeast/shared` over one workspace scoped transaction of indexed reads (an app, the markets of active keywords, a competitor, a saved keyword field, a deliverable email alert or active webhook, a used API token, an active console connection, a marked reply), never a stored done flag.
- An item that cannot be done is omitted, not locked: the keyword field without an App Store app, the console without `STORE_CONNECT_ENCRYPTION_KEY`, a reply before any review is stored.
- The only stored state is `Workspace.checklistGoal` (validated against `WORKSPACE_GOALS`; an unknown value reads as none) and `Workspace.checklistDismissedAt`, written by `PATCH /workspace/checklist`: a plain write (402 without a plan, 403 for a read token), not `@SessionOnly()`, not an MCP write tool.
- Whether the pill is collapsed is per viewer and lives in the browser (frontend rule 3).
