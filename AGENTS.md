# AGENTS.md — asobeast

## What this project is

**asobeast** is an open source, self hosted ASO (App Store Optimization) toolkit for indie developers and small teams. It imports an app from a store URL, stores metadata snapshots, extracts and tracks keywords, checks keyword rankings daily, scores keywords (traffic, difficulty, opportunity) and shows everything through a Next.js frontend talking to a NestJS API. All store requests run on the machine that hosts the app. Multi-country: an app is a **single tracking entity** with a home storefront (`app.country`, from the URL or `DEFAULT_COUNTRY`); keyword tracking carries its own country, so one app tracks keywords across many storefronts, filtered per market on the keyword monitor. **Both stores are live: Apple App Store and Google Play.** All scraping stays behind the `StoreProvider` interface (provider isolation unchanged), so a parser breakage is contained to one module.

**Everything described above is implemented and merged on `main`.** What constrains change is the compatibility promise: the HTTP contract, the `@asobeast/shared` contract types and the MCP tool surface are stable for the whole `1.x` line — read the release policy below before starting any change.

## Tech stack

- **Monorepo:** pnpm workspaces + Turborepo, Node.js 22+ (the images build on `node:24-alpine`), TypeScript strict everywhere
- **apps/api:** NestJS (latest stable), Prisma + PostgreSQL 18, BullMQ + Redis 8, Jest + Supertest
- **apps/web:** Next.js (latest stable, App Router, Tailwind), consumes the API over HTTP; Vitest + Playwright
- **apps/mcp:** stdio MCP server built with tsup, tested with Vitest. Both MCP surfaces run `@modelcontextprotocol/server@2.0.0` and serve protocol `2026-07-28` alongside the 2025 revisions from one factory
- **packages/shared:** `@asobeast/shared`, compiled with tsup (cjs + esm + dts), tested with Vitest
- **packages/typescript-config:** `@asobeast/typescript-config`, base tsconfigs
- Scraping: `@perttu/app-store-scraper` (App Store) and `@mradex77/google-play-scraper` (Google Play), both isolated behind the `StoreProvider` interface.
- Docker + docker compose for dev services and self hosting

## Repository layout

```text
apps/
  api/                    NestJS backend
    src/
      config/             typed env configuration
      prisma/             PrismaService + module
      common/             exception filter, workspace resolution
      health/             liveness + pipeline health
      auth/               sessions, personal api tokens, guards, entitlements
      admin-surfaces.ts   platform-operator gate for /admin/queues, /docs*, /metrics and /admin/support, wired from main.ts
      store-providers/    provider contract impls + registry (App Store + Google Play, both live)
      apps/               import, snapshots, refresh, linked app groups
      competitors/        competitor apps, comparison, gaps
      keywords/           extraction, tracked keywords, suggestions
      rankings/           rank capture + history, serp snapshots, volatility, movers
      category-ranks/     daily free/paid/grossing chart capture
      reviews/            review sync, ratings history, review-mined keyword ideas
      changes/            metadata change events (owned + competitor)
      scoring/            pure formulas + stats collection
      analytics/          visibility, summary, portfolio, weekly digest
      audit/              aso audit rubric engine, history + endpoints
      metadata/           metadata audit + keyword coverage
      actions/            aso action center: rules/, engine, lifecycle, endpoints
      alerts/             subscriptions, outbox, batching, webhook + smtp delivery
      ai/                 optional openai client (audit, drafts, action explanations)
      jobs/               BullMQ queues, workers (appstore + gplay), pipeline, retention
      mcp/                remote streamable http endpoint (POST /mcp) + in-process gateway
    prisma/               schema.prisma, migrations, seed.ts
    test/                 API e2e specs (supertest, providers mocked)
  web/                    Next.js frontend
    src/
      app/                App Router: page/layout/loading/error/not-found per segment
                          (/, /actions, /settings, /login, /register, /upgrade,
                           /apps/[id] + keywords, rankings, competitors, audit, metadata,
                           changes, reviews, actions, setup)
                          /api/health, /api/backend/[...path] (runtime proxy),
                          /admin/queues and /docs* (same-path proxies to the API surfaces)
      components/
        ui/               shadcn generated primitives (owned, editable)
        layout/           SiteHeader, ThemeToggle, HealthBadge, ErrorState, command palette
        actions/ apps/ app-detail/ overview/ keywords/ rankings/ competitors/ audit/
        metadata/ changes/ reviews/ settings/ onboarding/ auth/   feature + skeleton components
      lib/                api/ (typed transport: client.ts + one module per domain behind a barrel),
                          queries.ts (query keys + options + invalidation),
                          get-query-client.ts, search-params.ts (nuqs parsers), ranges.ts,
                          format.ts, countries.ts, csv.ts, metadata-display.ts, onboarding.ts, utils.ts
    e2e/                  Playwright specs + mock-api.mts (typed node:http mock on port 4100)
  mcp/                    MCP server (stdio): read-only tools over the HTTP API, mandatory personal token
    src/
      config.ts client.ts preflight.ts log.ts version.ts   env config, typed api client, boot preflight, stderr logging, manifest version
      tools/            thin registration wrappers over the shared catalog
packages/
  shared/                 @asobeast/shared: contract types, Store union, url parser, constants
  mcp-tools/              @asobeast/mcp-tools: the one tool catalog both MCP transports register
  typescript-config/      @asobeast/typescript-config: base.json, nest.json, next.json
docs/                     Mintlify documentation site published at docs.asobeast.com
turbo.json
pnpm-workspace.yaml
docker-compose.dev.yml    Postgres + Redis for development
docker-compose.yml        full self hosted stack, built from source
docker-compose.pull.yml   the same stack from the published GHCR images, no clone or build
docker-compose.tunnel.yml optional Cloudflare Tunnel overlay for either stack
```

## Commands (run from the repo root)

```bash
pnpm install
pnpm dev                        # turbo run dev: shared (tsup watch) + api + web
pnpm --filter api dev           # just the API
pnpm --filter web dev           # just the frontend
pnpm build                      # turbo run build (respects the dependency graph)
pnpm lint && pnpm test          # turbo run lint / test across all packages; lint never writes
pnpm --filter api lint:fix      # the only lint that rewrites files
pnpm --filter api test:e2e      # supertest e2e, providers mocked, separate REDIS_DB
pnpm --filter api test:isolation # two-workspace tenancy isolation suite, blocking in CI
pnpm --filter web test:e2e      # playwright against the typed mock api on port 4100
pnpm --filter api db:migrate    # prisma migrate dev (script inside apps/api)
pnpm --filter api db:studio
pnpm format:check               # prettier; the pre-commit hook formats staged files
docker compose -f docker-compose.dev.yml up -d
```

The browser suite needs its browser once: `pnpm --filter web exec playwright install chromium`.

## Git conventions (strict)

- Conventional commits: `type(scope): subject`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`, `revert`.
- Scopes: `repo` (workspace level), `api`, `web`, `mcp`, `shared`, `docker`, `ci`, `docs` (the Mintlify site in `/docs`), dependency scopes `deps`, `deps-dev`, plus API domain scopes `db`, `providers`, `apps`, `keywords`, `rankings`, `scoring`, `competitors`, `analytics`, `jobs`, `audit`, `metadata`, `changes`, `alerts`, `auth`, `actions` (domain scopes always mean code inside `apps/api`; `actions` means `apps/api/src/actions/`).
- Subject: imperative, lowercase, no trailing period, max 72 chars. One logical change = one commit; use the body only for what a reviewer cannot infer from the diff.
- Before every commit: `pnpm lint && pnpm test` green (plus `pnpm build` when configs or dependencies changed).
- Never commit `.env` files, `node_modules`, `dist`, `.next`, `.turbo`.
- The `pre-commit` hook formats staged files with lint-staged, and the `commit-msg` hook enforces the type, scope and subject rules with commitlint. Use `--no-verify` only in an emergency and explain it in the pull request.

### Roadmap and release policy

- `1.0.0` is the first release of this repository. The `1.x` line takes normal feature work under semantic versioning: a `feat` bumps the minor, a `fix` bumps the patch.
- **The compatibility promise is what constrains `1.x` now.** The HTTP contract, the `@asobeast/shared` contract types and the MCP tool surface stay compatible for the whole line; breaking any of them requires `2.0.0`. Additive change is fine — a new endpoint, a new optional field, a new tool. Removing or renaming anything on those three surfaces, or narrowing what a request accepts or a response guarantees, is not. Environment variables, the database schema and internal modules are outside the promise; schema changes always ship as forward Prisma migrations.
- The upgrade and backup drills read their baseline from `UPGRADE_FROM_TAG`, currently `v1.0.0`. While that tag is the current commit there is nothing to upgrade from, so CI resolves the baseline first and skips the drill steps rather than running a vacuous pass. The first release that adds a migration must bump the baseline and confirm the drill actually applied one.
- Every `fix` must include a regression test written from the reported symptom, observed failing for that reason before the fix, and passing afterward with the rest of the suite. Use a unit spec for logic, API e2e for a contract or guard, and Playwright for a user-visible flow.
- Release Please owns tags, versions and `CHANGELOG.md`. Never cut a release by hand while the pipeline is healthy. When a manual release is unavoidable, bump the six manifests together (`package.json`, `apps/{api,web,mcp}/package.json`, `packages/{shared,mcp-tools}/package.json`), match `.release-please-manifest.json` to them and push the matching `v` tag — `.github/scripts/verify-release-state.sh` fails the Release workflow when the manifest names a version origin has no tag for. See `docs/operations/release-recovery.mdx`.

## Coding conventions

- TypeScript `strict: true` in all packages, extending `@asobeast/typescript-config`. No `any` except where untyped scraper payloads enter the provider layer, mapped to typed structures immediately.
- Every controller input is a DTO validated with `class-validator`; global `ValidationPipe` with `whitelist: true`.
- Controllers thin, services own logic, scoring functions pure and unit tested.
- All scraping goes through the `StoreProvider` interface in `apps/api/src/store-providers/`. No other module may import a scraper library. This isolation contains parser breakage and lets a future cloud version swap in proxies or a data API.
- Store raw scraper payloads in `raw` Json columns; parsers change, raw data allows reprocessing.
- All dates UTC; daily granularity uses Postgres `date` (`@db.Date`); "today" is the UTC date.
- `installs` is `BigInt` (kept for future Google Play); JSON serialization patched in `apps/api/src/main.ts`.

## Documentation site

The public documentation lives in `/docs` and is published at `docs.asobeast.com` by Mintlify. It is not a pnpm workspace member and has no build step in this repository, so the Mintlify CLI is never a dependency and is always invoked through `pnpm dlx`.

- Preview with `pnpm docs:dev`. Check with `pnpm docs:check`, which runs `mint validate`, `mint broken-links` and `mint a11y`. Lint prose with `pnpm docs:prose`, which runs Vale.
- Every page needs a `title` and a `description`. Headings use sentence case. Prose uses no dash punctuation, meaning no em dash, no en dash and no spaced hyphen standing in for a comma or colon. Hyphenated compound modifiers are correct and stay. `docs/styles/asobeast/Dashes.yml` enforces this in CI.
- `docs/configuration/reference.mdx` is the single source of truth for environment variables on the site. A change to `apps/api/.env.example` or `apps/web/.env.example` updates it in the same commit.
- `docs/api-reference/openapi.json` is captured from the running API with `pnpm docs:openapi`. A change to a controller, a DTO or a response shape re-runs it.
- A fact lives on exactly one page. The concept pages under `docs/concepts/` own the domain rules and every other page links to them.
- Prettier does not format `docs/**/*.mdx`. Use `pnpm docs:format`, which runs Mintlify's canonical formatter.
- Use the `docs` commit scope for the site and `repo` for repository-level documentation such as `README.md` and `CONTRIBUTING.md`.
- **`README.md` follows the same dash rule as the site and is linted for it in CI** (`pnpm check:readme-prose`, and a step in `.github/workflows/docs.yml`). It is also deliberately short: it introduces the product, shows the install, answers the questions a search engine or an assistant gets asked, and links to `/docs` for everything else. A fact that belongs on a documentation page does not get a second copy in the README, so extend the page and link it.
- The root `pnpm.overrides` block holds transitive pins that a direct dependency cannot yet deliver, currently `deepmerge-ts` for GHSA-ggr8-5vv4-36mx, which the newest Prisma still resolves below. Drop an entry the moment its parent ships the fixed range, and validate any new one against `pnpm build`, `prisma validate` and a from-scratch `prisma migrate deploy` before committing it.
- `MINT_VERSION` and `VALE_VERSION` in `.github/workflows/docs.yml` are bumped by hand, as are the `cloudflared` pin in `docker-compose.tunnel.yml` and the `ASOBEAST_IMAGE_TAG` default in `docker-compose.pull.yml`, which tracks the current release. Dependabot does not cover them, because `/docs` has no manifest by design and the root Compose files are outside its docker directories. CI fails any Compose service whose image floats on `latest`.

## Code organization & file size

Decompose by **responsibility**, not by syntactic kind. The target is fewer concepts per file — not fewer lines, and not more files.

- **Soft size budget:** source files ~400 lines, functions ~80 (api) / ~150 (web). ESLint warns past these — treat a warning as "find the seam," not "pad to the limit." Tests and owned `components/ui/*` primitives are exempt.
- **Extract when** code is reused across modules (lift to `@asobeast/shared`, a domain helper, or `lib/`), is a nameable responsibility (a suggestion engine, a spider, a CSV exporter, an alert dispatcher), or is pure logic that deserves its own spec. This repo already does this well: `buckets.ts`, `extraction.ts`, `snapshot-diff.ts`, `visibility.ts`.
- **Colocate when** code is used in exactly one place. Do **not** create dumping-ground `const.ts` / `types.ts` / `utils.ts` files — a constant or type used once lives next to its use. (Contract types shared with the web are the exception: they live in `@asobeast/shared/contracts`.)
- **Oversized NestJS service?** Split into several focused providers inside the same feature module (the idiomatic fix), not one mega-class. Keep controllers thin, services single-responsibility, pure functions in their own unit-tested modules.
- **Oversized React component?** Extract sub-components, column/config definitions and pure formatters into the same feature folder; keep the component as the assembly. Colocation inside the feature folder beats a distant shared folder.
- A large but **cohesive** module of small pure functions (e.g. `audit-checks.ts`) is fine — do not shatter it to hit a line count. Relocating complexity is not reducing it.
- **`max-params` warns on NestJS DI constructors and those warnings are accepted, not acted on.** ESLint cannot exempt constructors, so the rule reports them; constructor injection is named, container-resolved wiring rather than a positional argument list, and a facade that exists only to shrink the count is churn. Treat a long DI constructor as a hint the provider does too much and answer it by splitting the provider — never by grouping its dependencies to silence the warning.
- **Refactor is separate from features:** a structure change and a behavior change are two commits (ideally two branches). Refactors preserve behavior — existing tests pass unchanged (unit specs may be _relocated_ with their code; assertions stay identical, e2e stays green).

## Shared code rules (monorepo discipline)

1. **Contract types live in `@asobeast/shared`.** Any request or response shape the frontend consumes is defined there (for example `AppListItem`, `TrackedKeywordItem`, `AppSummary`, `RankingSeries`, `ApiErrorEnvelope`). API DTO classes implement these interfaces (`implements X` or `satisfies`); the web app types its fetch calls with them. **Prisma generated types never cross the `apps/api` boundary.**
2. `@asobeast/shared` also owns the `Store` string union (`'APP_STORE' | 'GOOGLE_PLAY'`, values identical to the Prisma enum), the store URL parser, and normalization helpers reused by both apps. It must stay dependency light and runtime agnostic: no Nest, no Next, no Node only APIs.
3. `@asobeast/shared` is a **compiled package** (tsup, cjs + esm + dts). Do not switch it to raw TS exports; NestJS's CommonJS build cannot consume just in time TS packages cleanly.
4. Internal dependencies use `"@asobeast/shared": "workspace:*"`. Turborepo's `build` task has `"dependsOn": ["^build"]`, so consumers always see fresh output; `pnpm dev` keeps tsup in watch mode.
5. Never import across packages by relative path.
6. `apps/mcp` is a **consumer like the web app**: it talks to the API only over HTTP and types every call with `@asobeast/shared`. No Prisma, Nest or scraper imports.
7. **`@asobeast/mcp-tools` owns the tool catalog.** `MCP_TOOLS` is the single definition of the MCP surface — name, title, description, `z.object` input schema and the `GET` each tool wraps — and both transports register exactly it: `apps/mcp/src/tools/` for stdio and `apps/api/src/mcp/remote-tools.ts` for `POST /mcp`. It depends on `@asobeast/shared` and `zod` and nothing else, and `parity.test.ts` proves the registration has not drifted.

## Frontend rules (apps/web)

1. **One transport, typed by shared.** The `src/lib/api/` module is the only place that talks to the API — a barrel over one file per domain, with `client.ts` owning `apiFetch`/`ApiError`/`withQuery` and one function per endpoint, every call typed by an `@asobeast/shared` contract. Never redefine a response shape locally and never import Prisma types.
2. **The query cache owns freshness.** `src/lib/queries.ts` holds the `appKeys` hierarchy, the `queryOptions` factories and the mutation invalidation helpers (`invalidateKeywordMutation`, `invalidateCompetitorMutation`, …) — the single place invalidation sets are written down. Pages prefetch into a shared `getQueryClient()` and render a `HydrationBoundary`; client feature components use `useSuspenseQuery`/`useMutation`. **`router.refresh()` is banned** — after a mutation, invalidate or seed the cache.
3. **URL is the state.** Sort, date-range presets, selected keyword ids and filters live in `searchParams` via `nuqs` parsers in `src/lib/search-params.ts` (built from shared unions). No duplicate `useState` for view state.
4. **Boundaries per section.** Every route segment has `loading.tsx` (geometry-matched skeleton) and `error.tsx` (shared `ErrorState`, recovers via `unstable_retry`); every `useSuspenseQuery` consumer sits under a local `Suspense` boundary, not the whole page.
5. **Domain rendering.** Position is 1-based; `null` means "checked, not found within the captured depth" → render `>100` or `>200` from the row's depth, never `0`. Ranking charts use a reversed Y axis (1 on top). Dates are UTC `date` strings formatted with `Intl.DateTimeFormat` pinned to UTC. Traffic/difficulty/opportunity are 0–100 scores. `refresh` returns a snapshot diff to show; `run-daily` and `score` return 202 queued — toast "queued" and let the cache refetch.
6. **Theming & a11y.** shadcn primitives live in `components/ui` (owned, editable); dark mode via `next-themes` class strategy. Icon-only buttons carry `aria-label`, dialogs carry a description, tables carry a caption, charts keep `accessibilityLayer`, and colour is never the only signal.
7. **The shell is a sidebar, and page width is a per-page decision.** `(app)` routes render inside `SidebarProvider` + `SidebarInset`; `(auth)` routes (`/login`, `/register`, `/upgrade`) render a centered card with no sidebar. Route groups keep every URL unchanged. Each page picks one of three width utilities from `src/styles/layout.css`: `page-full` for tables and charts that want every pixel (keywords, rankings, competitors), `page-wide` for dashboards and grids at a 1600 px ceiling (portfolio, overview, actions, changes, reviews, metadata), and `page-reading` at 720 px for prose and forms (settings, audit, setup). Gutters come from `page-gutter`, which folds `env(safe-area-inset-*)` into the density scale — never per-page padding.
8. **Charts go through the chart system.** `src/components/charts/theme.ts` owns axes, grid, margins, heights, the series palette and the stroke-pattern order; no chart configures those inline and no chart references `--chart-N` directly. Multi-series charts distinguish series by stroke pattern as well as colour, and every chart has loading, empty and insufficient (fewer than four points) states at its real height.

## Domain rules that are easy to get wrong

1. **Both stores are live.** The Prisma enum, shared `Store` union and URL parser cover App Store and Google Play, and `SUPPORTED_STORES` lists both. Play search indexes **title (30), short description (80) and long description (4000)** — there is no subtitle and no keyword field, so those two stay Apple-only concepts everywhere (types, lints, audit weight 0, hidden in the web). Play's indexed 80-char short description (`summary`) is its equivalent surface: it is auto-tracked (`DESCRIPTION` source), linted (`lintShortDescription`) and coverage-checked. The 501 `StoreNotSupportedError` path stays wired for any _future_ store, not for Play.
2. **The iOS keyword field (100 chars) is private.** It never appears on the store page and cannot be scraped; the owner pastes it manually (source `KEYWORD_FIELD`).
3. **Rate limits.** The iTunes endpoints informally tolerate roughly 20 requests per minute per IP; the `appstore` worker runs concurrency 1 with a limiter from `SCRAPE_ITUNES_RPM` (default 15). Google Play is more sensitive: the `gplay` worker runs concurrency 1 with a limiter from `SCRAPE_GPLAY_RPM` (default 10) that spaces **job starts**. A Play score job fans out to ≈15–18 sequential requests (1 search + ≤7 prefix-probe suggests + 10 detail `getApp` enrichments), while a depth-200 Play rank job uses roughly eight requests versus one for Apple. Never call store endpoints in bulk outside the queue (the only exception: small, user initiated suggestion lookups).
4. **One app, per-market keyword tracking; one search serves everyone, including across tenants.** `Keyword`, `KeywordMetric` and `SerpEntry` are **global** and carry no policy: two workspaces tracking "habit tracker" in the US share one search rather than paying for two, which is the entire efficiency argument for the shared keyword row and is worth far more under multi-tenancy than under one tenant. What is tenant-owned is the **tracking relation** and the recorded position, so `checkKeyword` reads its trackers through the escape hatch, asks `CollectionEligibility` which of the owning workspaces may still be collected for, and then writes rankings and fires alerts inside each of those. The gate matters because the search is shared: without it a workspace that is suspended, unentitled or past its keyword limit keeps receiving fresh rows whenever another tenant happens to schedule the same phrase. Quota counts keyword-market pairs tracked by a workspace, never global keyword rows. An app is a single row; countries live on keyword tracking (`Keyword` is scoped by `text, store, country`), so a single app owns keywords across storefronts, added and filtered per market on the keyword monitor. `checkKeyword` searches `keyword.country` (not `app.country`) and records positions for the primary app and all its competitors in that storefront from one search — never one search per app. The same phrase tracked in two markets is two keyword rows checked by two searches; rankings differ per storefront. Each added market multiplies daily search volume against the same `SCRAPE_ITUNES_RPM` budget; `GET /jobs/budget` estimates the fan-out and the settings budget card surfaces it. The iOS keyword field, category ranks, reviews, snapshots and auto-tracked keywords stay on the home market in v1 (a full per-market app-detail switcher is backlog).
5. **Opportunity is per app, not per keyword.** Traffic and difficulty persist in `KeywordMetric`; opportunity depends on the app's keyword relevance and is computed in the read layer only (aso-skills formula).
6. **Position semantics.** 1 based; `null` means "checked, not found within `depth`" (default 200). Store the row even when null.
7. **Tenancy is enforced by the database, not by remembering to filter.** Every tenant-owned table has a `tenant_isolation` policy reading `app.workspace_id`, and every Prisma operation runs in a transaction that calls `app_enter_workspace` and switches to the non-owner `asobeast_app` role — without that switch a superuser or the table owner bypasses the policies entirely. A query with no workspace in scope therefore returns nothing rather than everything, so **service code does not carry `workspaceId` in a `where` clause**; it resolves the workspace from `WorkspaceContext` when it writes, and lets the policies scope what it reads. Work that genuinely spans tenants — account resolution, the scheduled pipeline, retention, operator health — goes through `CrossTenantAccess`, whose one method demands a written justification. `DEFAULT_WORKSPACE_ID` is a bootstrap value; an ESLint rule fails the build if it reaches any other service. Migrations and the seed must run as a role that bypasses the policies (the superuser the images already use).
8. **Scrapers break.** Parse failures fail the job (BullMQ retries with backoff) and must never take down request handling.
9. **Authentication is mandatory, and self registration never joins a workspace that already holds data.** Every request is authenticated by `AuthGuard` (session cookie or `asob_` Bearer token) and then authorized by `EntitlementGuard`; `@Public()` is the only authentication bypass. **`AUTH_REGISTRATION_WORKSPACE` decides where a registration lands, and it defaults to `own` in every mode**: only the bootstrap owner joins `ws_default`, every later account gets its own workspace and owns it, and open registration is safe precisely because no two accounts share a workspace and the RLS policies scope every read. The `shared` value drops every sign up into `ws_default` as a `member` instead, and it is an explicit opt-in for an instance whose sign ups are all trusted with the data already there; it **refuses to boot** with `BILLING_ENABLED=true`, because hosted registration is open to strangers. Sharing a workspace with a teammate is what the invite flow in `workspace-team.service.ts` is for, never self registration, so do not re-tie the workspace decision to `BILLING_ENABLED`: a flag about payment must not decide who reads whose data. Registration decides that under a `pg_advisory_xact_lock`, creating the workspace and the user in one transaction, so concurrent first registrations cannot both bootstrap and a duplicate email cannot leave an orphan workspace. `BILLING_ENABLED` is also the premium seam — unentitled requests get **402**; entitlement and plan live on `Workspace` (`plan`, `trialEndsAt`, `planExpiresAt`, `billingCustomerId`, `subscriptionId`), never on `User`, because a workspace has one plan whatever the size of the team. Account and paywall routes stay reachable via `@AllowUnentitled()`, and an unentitled workspace keeps every session read and export while every write, every on-demand action and every `asob_` token request answers 402 — data is theirs, capacity is what they pay for.
10. **Both MCP surfaces are mandatory-token, read-only surfaces.** `apps/mcp` is the stdio binary and authenticates like any other client: it sends `ASOBEAST_API_TOKEN` (`asob_…`) as a Bearer header on every request and a boot-time preflight (`/auth/me`) exits non-zero against a missing or invalid token or an unentitled instance. `apps/api/src/mcp/` is the remote endpoint: `POST /mcp` takes the same `asob_` token through `AuthGuard`, refuses a session cookie with 401, and dispatches each tool in process through `InProcessGateway` rather than over a socket. Every tool on both is a `GET` annotated `readOnlyHint: true`; mutations stay backlog behind an explicit opt-in. On stdio the JSON-RPC stream owns stdout, so all diagnostics go to stderr and the token is never logged. **`packages/mcp-tools` must never import an MCP SDK package**: it is the single definition both transports read, and an SDK import there would put a bundled type identity between two packages that must stay interchangeable.
11. **The admin surfaces bypass Nest's guards, so they carry their own gate.** Bull Board mounts its own Express router and `SwaggerModule.setup` registers on the Express adapter, so `AuthGuard`/`EntitlementGuard` never run for `/admin/queues` or the `/docs*` routes. `configureAdminSurfaces` — called from `main.ts` before `app.listen` and from the e2e app — resolves the session cookie or `asob_` token itself and answers **404** (never 401/403: the surface does not confirm it exists) unless the caller is an entitled **platform operator**. It also keeps the resolved token's **scope**: `/admin/queues` is the one write-capable admin surface, so a read-scoped token gets 404 on any non-`GET`/`HEAD`/`OPTIONS` method there while still reading the dashboard. `/admin/queues` is always gated that way; the `/docs*` routes are gated only under `API_DOCS=owner` (the default), because `public` serves them to anyone and `off` never registers them. Bull Board then re-asserts that grant through `requireAdminAccess`, so an application that forgets the wiring fails closed. Middleware order is the reason `main.ts` is the right place: Nest registers module middleware during `app.init()`, which `listen()` triggers, so an `app.use` in `main.ts` lands ahead of it. Both surfaces are reachable only through the web app's origin, via route handlers at the **identical path** (`apps/web/src/app/admin/queues`, `/docs`, `/docs-json`, `/docs-yaml`), because both SPAs build asset URLs from their mount path. A new Swagger route variant must be added to `DOCS_ROUTES`; a missing entry silently serves the whole OpenAPI document to anonymous callers.

    **The platform operator is not a workspace owner.** `isPlatformOperator` in `apps/api/src/auth/platform-operator.ts` is the only definition: the `owner` of the bootstrap workspace. It has to be, because hosted registration makes every customer the `owner` of their own workspace, so `role === 'owner'` alone would hand every customer the instance-wide surfaces. Every cross-tenant surface authorizes with it and nothing else — `configureAdminAccess` (queues, docs, metrics, support), `SupportController`, `MetricsController`, `CapacityController` and `ProxyPoolController` — and each answers **404** to a tenant owner. `OwnerGuard` and the account deletion check stay plain workspace-owner checks, because owning your own workspace is exactly what authorizes them. `platform-operator.ts` is the one service file the `DEFAULT_WORKSPACE_ID` ESLint rule exempts, alongside `auth.service.ts`.

12. **The Action Center is deterministic; AI is optional garnish.** Every recommendation in `apps/api/src/actions/` is a pure function of stored data with named exported constants and boundary tests — AI may only summarize an action that already exists, never create, rank, re-order or suppress one, and the whole feature works with `OPENAI_API_KEY` unset. An action's `fingerprint` is `sha256(rule~appId~store~country~keywordId~discriminator)` and **excludes every volatile magnitude** (positions, scores, counts, observation dates); including one would mint a new action every run and destroy the `open/snoozed/done/dismissed/resolved` lifecycle. Metadata-coverage rules are **home-market only** because asobeast stores one metadata snapshot per app, while market rules are per-country and word themselves as "investigate this market" — the localized listing has never been seen.

## Environment variables

`apps/api/.env.example`, `apps/web/.env.example` and the root `.env.example` are the authoritative list; the blocks below mirror them and must be updated in the same commit as any config change.

`apps/api/.env`:

```bash
NODE_ENV=development         # development, test or production. The Docker image sets production, which turns on the configuration guards
DATABASE_URL=postgresql://asobeast:asobeast@localhost:5432/asobeast
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0                   # bull queue db index; e2e tests use a separate index
PORT=4000
DEFAULT_COUNTRY=us
CRON_DAILY=0 3 * * *        # daily pipeline start, UTC; batched alerts send after processing completes
CRON_SCORING=0 4 * * 0      # weekly scoring, UTC (Sunday)
SCRAPE_ITUNES_RPM=15
SCRAPE_GPLAY_RPM=10         # google play job-starts/minute; each Play score job fans out to ~15-18 requests
PROXY_PROVIDER=none                 # none keeps every store request on the host address; webshare reconciles the pool against that account's proxy list
PROXY_API_URL=https://proxy.webshare.io/api/v2  # provider api base url
PROXY_API_KEY=                      # provider api key. REFUSES TO BOOT when PROXY_PROVIDER is not none and this is empty
PROXY_USERNAME=                     # credentials shared across the pool; empty for an ip-authorized account
PROXY_PASSWORD=                     # password for PROXY_USERNAME
PROXY_ENDPOINT_RPM=15               # requests per minute per pool endpoint; replaces the single host budget once the pool is on
PROXY_ACQUIRE_TIMEOUT_MS=120000     # how long a job waits for a free endpoint before it fails and the queue retries it; a shutdown ends the wait at once
PROXY_WORKER_MAX_CONCURRENCY=8      # ceiling for store worker concurrency once the pool is on; actual concurrency tracks the healthy endpoint count. Ignored while PROXY_PROVIDER=none
CRON_PROXY_SYNC=0 2 * * *           # pool reconciliation against the provider, UTC. Never scheduled while PROXY_PROVIDER=none
PROXY_RESIDENTIAL_URL=              # emergency gateway used only after a datacenter endpoint is blocked. Empty disables the fallback
PROXY_RESIDENTIAL_USERNAME=         # gateway credentials
PROXY_RESIDENTIAL_PASSWORD=         # password for PROXY_RESIDENTIAL_USERNAME
PROXY_RESIDENTIAL_MONTHLY_CAP_USD=0 # hard monthly ceiling. 0 refuses every fallback, so a broad block cannot become an unbounded bill
PROXY_RESIDENTIAL_COST_PER_GB=3     # provider list price, used to price the cap
PROXY_RESIDENTIAL_MB_PER_REQUEST=1.2 # measured average response size; with the price per gigabyte this estimates month to date spend
SIGNUP_CAPACITY_MAX_UTILIZATION=0   # 0 disables the gate. Above 0, registration is refused with 503 once tracked collection passes this share of daily capacity. Only applied when BILLING_ENABLED=true
ALERT_RANK_DROP_THRESHOLD=5  # positions a primary app must move to fire a rank alert
ALERT_REVIEW_SCORE_MAX=2     # reviews at or below this star rating fire review.negative (1-4)
ALERT_DELIVERY=batched              # batched: up to two scoped reports/channel after daily completion; instant: per-event delivery. WARNS in production when instant has no SMTP configured; webhook subscriptions live in the database and cannot be checked here
WEBHOOK_ALLOW_PRIVATE_TARGETS=false # false keeps alert webhooks on public addresses, refusing loopback, private, link-local and cloud metadata targets at both registration and connection time. true opts a self-hosted instance in to LAN delivery. REFUSES TO BOOT when true and BILLING_ENABLED=true, because a webhook url is chosen by the customer; WARNS in production otherwise
CRON_RETENTION=0 5 * * *            # data retention pruning, UTC
CRON_DIGEST=0 8 * * 1               # weekly digest webhook, UTC (Monday 08:00)
CRON_AUDIT=0 6 * * *                # daily audit score snapshot, UTC (after the daily pipeline)
RETENTION_RANKINGS_DAYS=365         # keyword rankings; 0 keeps forever
RETENTION_SERP_DAYS=90              # serp entries; 0 keeps forever
RETENTION_SNAPSHOTS_DAYS=180        # app snapshots; newest per app always kept; 0 keeps forever
RETENTION_CATEGORY_RANKS_DAYS=365   # category ranks; 0 keeps forever
RETENTION_CHANGE_EVENTS_DAYS=0      # change events; 0 keeps forever
RETENTION_DELIVERIES_DAYS=30        # alert delivery log rows; 0 keeps forever
RETENTION_AUDIT_SCORES_DAYS=0       # audit score rows; 0 keeps forever
RETENTION_BILLING_EVENTS_DAYS=90    # stored stripe webhook payloads; they carry customer billing details. 0 keeps forever
RETENTION_ACTIONS_DAYS=180          # closed action items (done/dismissed/resolved); open and snoozed are never pruned by age; 0 keeps forever
ACTIONS_MAX_OPEN_PER_APP=20         # new actions one generation run may open per app, highest impact first
ACTIONS_SNOOZE_MAX_DAYS=90          # furthest a snooze may be set into the future
ALERT_ACTIONS_MIN_PRIORITY=high     # lowest priority that fires action.opened: critical|high|medium|low
WEB_PUBLIC_URL=                     # public web origin; only used to build deep links inside alert payloads
RETENTION_ALERT_EVENTS_DAYS=30      # completed alert claims; unfinished claims are retained; 0 keeps forever
SMTP_HOST=                          # email alerts stay disabled until SMTP_HOST and SMTP_FROM are both set
SMTP_PORT=587                       # 465 with SMTP_SECURE=true, otherwise 587/25
SMTP_SECURE=false                   # true wraps the connection in TLS (port 465). WARNS in production when true on any other port
SMTP_USER=                          # optional; empty for unauthenticated relays
SMTP_PASSWORD=                      # optional
SMTP_FROM=                          # e.g. asobeast <alerts@example.com>
OPENAI_API_KEY=                     # optional; enables the AI audit + metadata drafts + action explanations. Empty = AI actions disabled (endpoints 409), drafts card hidden, audit shows a setup hint
AI_MODEL=gpt-4o                     # OpenAI model with vision + structured outputs
BULL_BOARD_ENABLED=true             # queue dashboard at /admin/queues; platform-operator only, proxied through the web app
API_DOCS=owner                      # openapi surface: owner (platform-operator session or asob_ token), public, or off. WARNS in production when public
METRICS_CACHE_SECONDS=30            # how long one /metrics scrape is reused before the collectors run again; 0 collects on every scrape
BACKUP_MAX_AGE_HOURS=0              # hours a backup may go without reporting in before backup.stale fires; 0 expects no backup and never alerts
DISK_BUDGET_BYTES=0                 # bytes the database may grow to before storage.headroom.low fires; 0 declares no budget and never alerts
AUTH_SECRET=                        # required; >=32 chars or the app refuses to boot (openssl rand -hex 32); changing it signs everyone out
AUTH_SESSION_DAYS=7                 # session cookie lifetime in days
AUTH_ALLOW_REGISTRATION=false       # true keeps signups open; false closes registration once the first (owner) account exists (self-hosted). The first account always bootstraps as owner regardless
AUTH_REGISTRATION_WORKSPACE=own     # where a self registration lands. own gives every sign up its own workspace, so a stranger never sees the data already tracked here; shared puts them all in ws_default as members, an explicit opt-in for an instance whose sign ups are already trusted. REFUSES TO BOOT when shared and BILLING_ENABLED=true. WARNS in production when shared and AUTH_ALLOW_REGISTRATION=true
AUTH_COOKIE_SECURE=false            # REFUSES TO BOOT when false and NODE_ENV=production. The Docker image sets NODE_ENV=production, so the Compose stack defaults this to true
STRIPE_SECRET_KEY=                   # optional; billing is inert without it. Never logged
STRIPE_WEBHOOK_SECRET=              # required to accept /billing/webhook; an unverified endpoint grants subscriptions to anyone
STRIPE_PORTAL_RETURN_URL=           # where the customer portal returns to; defaults to WEB_PUBLIC_URL/settings
STRIPE_PRICE_INDIE_MONTHLY=         # price ids differ per environment; create them with pnpm --filter api stripe:catalog
STRIPE_PRICE_INDIE_YEARLY=
STRIPE_PRICE_ULTIMATE_MONTHLY=
STRIPE_PRICE_ULTIMATE_YEARLY=
CRON_BILLING_RECONCILE=0 7 * * *    # daily reconciliation against Stripe, UTC
CRON_TRIAL_NOTICES=0 9 * * *      # trial milestone emails, UTC
BILLING_ENABLED=false               # entitlement seam: new accounts start a trial and lose access afterwards until plan=premium; registration stays open
TRIAL_DAYS=7                        # trial length in days when BILLING_ENABLED=true. REFUSES TO BOOT at 0 with billing enabled
TRUST_PROXY=false                   # true only behind a reverse proxy that sets a trustworthy X-Forwarded-For; lets auth throttling key on the real client IP instead of the proxy's. WARNS in production when false
ACCOUNT_DELETION_GRACE_DAYS=7       # days a scheduled workspace deletion stays reversible before the retention job erases it
ERROR_TRACKING_DSN=                 # optional, hosted only. Sentry compatible dsn for scrubbed error reports. Ignored unless BILLING_ENABLED=true, so a self hosted deployment never reports errors outside itself
LOG_LEVEL=debug
```

`apps/web/.env`:

```bash
API_INTERNAL_URL=http://localhost:4000   # read at runtime; the browser reaches it via /api/backend/*
API_PROXY_TIMEOUT_MS=30000               # upper bound per proxy request; a timeout returns a 504 envelope
```

Root `.env` (Compose only): `POSTGRES_PASSWORD` and `AUTH_SECRET`, both required and non-empty, plus `AUTH_COOKIE_SECURE`, `TRUST_PROXY`, `LOG_LEVEL` and `STATUS_PAGE_URL`. `ASOBEAST_IMAGE_OWNER` and `ASOBEAST_IMAGE_TAG` are read only by `docker-compose.pull.yml` and pick which published images that stack runs; they default to the images this repository publishes at the current version, so pinning an older release is the only reason to set them. `TUNNEL_TOKEN` and `ASOBEAST_DOMAIN` are read only by `docker-compose.tunnel.yml`, the optional Cloudflare Tunnel overlay that terminates TLS at Cloudflare's edge and stops publishing host port 3001, so the machine listens for nothing.

## What NOT to do

- No breaking change to the HTTP contract, the `@asobeast/shared` contract types or the MCP tool surface inside `1.x`; removal, renaming and narrowing all need `2.0.0`. Add alongside instead.
- No hand-cut release while the pipeline is healthy; Release Please owns tags, versions and `CHANGELOG.md`.
- No `fix` without a regression test that was observed failing for the reported symptom first.
- No alternative ORMs, queue systems, HTTP clients, package managers or task runners; the stack is fixed.
- No store calls in tests; providers are mocked in unit and e2e tests.
- No manual SQL migrations; always `prisma migrate dev`.
- No scraper imports outside the `StoreProvider` interface; all scraping goes through the provider layer.
- No comments inside code. DRY, KISS, CLEAN CODE.
