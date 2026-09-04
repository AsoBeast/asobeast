# asobeast feature inventory

Derived from route files, controllers and navigation components at commit `08225c3` on
`claude/asobeast-regression-testing-f0udcj`. Every row was read out of the code, not assumed.

## Web routes (`apps/web/src/app`)

| Feature                | Entry point                     | Owning file                                        |
| ---------------------- | ------------------------------- | -------------------------------------------------- |
| Dashboard / portfolio  | `/`                             | `(app)/page.tsx`                                    |
| Action Center          | `/actions`                      | `(app)/actions/page.tsx`                            |
| Settings               | `/settings`                     | `(app)/settings/page.tsx`                           |
| API tokens             | `/tokens`                       | `(app)/(dev)/tokens/page.tsx`                       |
| App overview           | `/apps/[id]`                    | `(app)/apps/[id]/page.tsx`                          |
| App keywords           | `/apps/[id]/keywords`           | `(app)/apps/[id]/keywords/page.tsx`                 |
| App rankings           | `/apps/[id]/rankings`           | `(app)/apps/[id]/rankings/page.tsx`                 |
| Competitors            | `/apps/[id]/competitors`        | `(app)/apps/[id]/competitors/page.tsx`              |
| Reviews                | `/apps/[id]/reviews`            | `(app)/apps/[id]/reviews/page.tsx`                  |
| Metadata workbench     | `/apps/[id]/metadata`           | `(app)/apps/[id]/metadata/page.tsx`                 |
| ASO audit              | `/apps/[id]/audit`              | `(app)/apps/[id]/audit/page.tsx`                    |
| Change detection       | `/apps/[id]/changes`            | `(app)/apps/[id]/changes/page.tsx`                  |
| Per-app actions        | `/apps/[id]/actions`            | `(app)/apps/[id]/actions/page.tsx`                  |
| App setup              | `/apps/[id]/setup`              | `(app)/apps/[id]/setup/page.tsx`                    |
| Login                  | `/login`                        | `(auth)/login/page.tsx`                             |
| Register (owner setup) | `/register`                     | `(auth)/register/page.tsx`                          |
| Forgot password        | `/forgot-password`              | `(auth)/forgot-password/page.tsx`                   |
| Reset password         | `/reset-password`               | `(auth)/reset-password/page.tsx`                    |
| Email verification     | `/verify`                       | `(auth)/verify/page.tsx`                            |
| Team invite accept     | `/invite`                       | `(auth)/invite/page.tsx`                            |
| Plan upgrade           | `/upgrade`                      | `(auth)/upgrade/page.tsx`                           |
| Queue dashboard        | `/admin/queues`                 | `admin/queues/[[...path]]/route.ts`                 |
| API reverse proxy      | `/api/backend/*`                | `api/backend/[...path]/route.ts`                    |
| Web health             | `/api/health`                   | `api/health/route.ts`                               |
| OpenAPI docs           | `/docs`, `/docs-json`, `/docs-yaml` | `docs/*`                                        |
| Prometheus metrics     | `/metrics`                      | `metrics/route.ts`                                  |

Navigation is rendered by `components/layout/AppSidebar.tsx`, `SidebarNav.tsx`,
`AppSwitcher.tsx`, `Breadcrumbs.tsx`, `CommandPalette.tsx`, `HealthBadge.tsx`.

## API routes (`apps/api/src`)

| Area              | Routes                                                                                                                                                                              | Controller                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Auth              | `POST /auth/register,login,logout,verify,verify/resend,password,password/forgot,password/reset`; `GET /auth/me,plan,status,tokens`; `POST /auth/tokens`; `DELETE /auth/tokens/:id`    | `auth/auth.controller.ts`           |
| Team              | `GET /workspace/team`; `POST /workspace/invites`, `invites/accept`; `DELETE /workspace/invites/:id`, `members/:id`                                                                    | `auth/workspace-team.controller.ts` |
| Account           | `GET /account/export,deletion`; `POST /account/deletion`; `DELETE /account/deletion`                                                                                                  | `account/account.controller.ts`     |
| Apps              | `POST /apps`; `GET /apps`, `/apps/:id`, `/apps/:id/market-availability`; `POST /apps/:id/refresh`, `/apps/:id/link`; `DELETE /apps/:id`, `/apps/:id/link`                             | `apps/apps.controller.ts`           |
| Keywords          | `GET /apps/:id/keywords,keyword-countries,keywords/compare,keywords/suggestions,keywords/spider,keyword-field`; `POST /apps/:id/keywords,keywords/spider`; `PATCH`/`DELETE keywords/:keywordId`; `PUT keyword-field` | `keywords/keywords.controller.ts`   |
| Rankings / SERP   | `GET /apps/:id/rankings`, `/apps/:id/serp-movers`, `/keywords/:keywordId/serp`                                                                                                        | `rankings/*.controller.ts`          |
| Scoring           | `POST /keywords/:keywordId/score`                                                                                                                                                    | `jobs/scoring.controller.ts`        |
| Analytics         | `GET /apps/:id/summary,visibility-history,rank-distribution-history,ratings-history`; `GET /portfolio`                                                                                | `analytics/*.controller.ts`         |
| Competitors       | `GET /apps/:id/competitors,analysis,discovery`; `POST /apps/:id/competitors`; `DELETE /apps/:id/competitors/:competitorId`                                                            | `competitors/competitors.controller.ts` |
| Reviews           | `GET /apps/:id/reviews`, `/apps/:id/reviews/histogram`                                                                                                                               | `reviews/reviews.controller.ts`     |
| Changes           | `GET /apps/:id/changes`, `/changes/recent`                                                                                                                                           | `changes/*.controller.ts`           |
| Audit / metadata  | `GET /apps/:id/audit,audit/history`; `POST /apps/:id/audit/ai`; `GET /apps/:id/metadata/audit`; `GET /metadata/assistant`; `POST /apps/:id/metadata/assistant`                        | `audit/*`, `metadata/*`             |
| Category ranks    | `GET /apps/:id/category-ranks`                                                                                                                                                       | `category-ranks/*.controller.ts`    |
| Actions           | `GET /actions,summary,ai-status`; `PATCH /actions/:id`; `POST /actions/:id/explain`, `/actions/run`; `GET /apps/:id/actions`                                                          | `actions/actions.controller.ts`     |
| Alerts            | `GET /alerts/config,delivery,deliveries`; `POST /alerts/flush`; CRUD `/webhooks`, `/email-alerts` (+ `POST :id/test`)                                                                 | `alerts/*.controller.ts`            |
| Jobs              | `POST /apps/:id/run-daily`; `GET /apps/:id/first-run`, `/jobs/budget,run-status,store-health`, `/admin/capacity`                                                                      | `jobs/jobs.controller.ts`           |
| Billing           | `GET /billing/catalog`; `POST /billing/checkout,portal,reconcile,webhook`                                                                                                            | `billing/*.controller.ts`           |
| Support (admin)   | `GET /admin/support/workspaces`, `/:workspaceId`; `POST .../reconcile,suspend,restore,run-daily`                                                                                      | `support/support.controller.ts`     |
| Proxy pool        | `GET /admin/proxy-pool`                                                                                                                                                              | `store-providers/egress/*`          |
| MCP               | `POST /mcp`                                                                                                                                                                          | `mcp/mcp.controller.ts`             |
| Health / metrics  | `GET /health`, `GET /metrics`                                                                                                                                                        | `health/*`, `metrics/*`             |

## Background work

Cron schedules from `apps/api/.env.example`: `CRON_DAILY` (daily pipeline), `CRON_SCORING`
(weekly), `CRON_RETENTION`, `CRON_DIGEST` (weekly digest), `CRON_AUDIT`, `CRON_PROXY_SYNC`,
`CRON_STORE_CANARY`, `CRON_STORE_STATUS`. Queues run on BullMQ/Redis and are visible at
`/admin/queues` when `BULL_BOARD_ENABLED=true`.
