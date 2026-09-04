## Summary
`GET /apps/:id/actions` answers 200 with an empty list for an app id that does not exist, or
that belongs to another workspace, while every sibling route under `/apps/:id` answers 404.
No data leaks, but a client cannot tell "this app has no actions" from "this app is not
yours" or "this id is wrong".

## Severity
P3 cosmetic
Impact: API consumers and the MCP tools. There is no data exposure: the query is workspace
scoped and returns nothing for a foreign app. The cost is an inconsistent contract, and a
per-app actions page for a mistyped id renders an empty state instead of a not-found state.

## Environment
- Commit: 08225c3c60912d52521d849d2e01855e62e4da1a on claude/asobeast-regression-testing-f0udcj
- Stack: API on Nest, PostgreSQL 16, Redis
- Account: owner (`ws_default`) and a second workspace (`ws_other`)

## Steps to reproduce
1. As the owner of workspace A, `GET /apps/totally-made-up-id/actions`
2. For comparison, `GET /apps/totally-made-up-id/keywords`
3. Sign in as a user of workspace B and `GET /apps/<workspace A app id>/actions`
Reproducibility: 5/5 attempts.

## Expected result
404 in all three cases, matching `/apps/:id/keywords`, `/rankings`, `/reviews`, `/changes`,
`/competitors`, `/audit`, `/metadata/audit`, `/summary`, `/category-ranks`,
`/visibility-history`, `/ratings-history`, `/keyword-countries` and `/keyword-field`, which
all answer `404 App <id> not found`.

## Actual result
Step 1: `200 {"items":[],"total":0,"generatedAt":"2026-09-04T19:32:12.722Z"}`
Step 2: `404 {"statusCode":404,...,"message":"App totally-made-up-id not found"}`
Step 3: `200 {"items":[],"total":0,"generatedAt":null}`

## Evidence
Verified that this is not a data leak. With an open `ActionItem` seeded for workspace A:
- workspace A, `GET /apps/<A app>/actions` -> the action is listed
- workspace B, `GET /apps/<A app>/actions` -> `{"items":[],"total":0,"generatedAt":null}`
- workspace B, `GET /actions` -> `{"items":[],"total":0,"generatedAt":null}`
Full cross-tenant sweep in `qa/report-2026-09-04.md` (TC-AUTHZ-001..017); every other route
returned 404.

## Suspected cause
Hypothesis, not fixed here. `AppActionsController.list`
(`apps/api/src/actions/actions.controller.ts:102`) passes the id straight to
`ActionsService.list(query, id)` as a filter. The sibling controllers call the shared
`ensureApp` helper first, which is what raises the 404.

## Related
TC-AUTHZ-013, TC-AUTHZ-018. See `qa/report-2026-09-04.md`.
