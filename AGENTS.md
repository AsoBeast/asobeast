# AGENTS.md: asobeast

## What this project is

**asobeast** is an open source, self hosted ASO (App Store Optimization) toolkit: it imports an app from a store URL, snapshots its metadata, tracks keywords and their daily rankings per market, scores keywords (traffic, difficulty, opportunity) and serves it all through a Next.js frontend, a NestJS API and an MCP server. Both stores are live (App Store and Google Play), and every store request runs on the host. An app is one tracking entity with a home storefront (`app.country`); each tracked keyword carries its own country.

**The compatibility promise constrains every change.** The HTTP contract, the `@asobeast/shared` contract types and the MCP tool surface stay compatible for the whole `1.x` line. Adding is fine (an endpoint, an optional field, a tool); removing, renaming or narrowing what a request accepts or a response guarantees needs `2.0.0`. Environment variables, the database schema and internal modules are outside the promise; schema changes ship as forward Prisma migrations.

## Where the rules live

This file holds what applies everywhere. The detailed rules live in `.claude/rules/`, one file per area, each with a `paths:` list of the API and web files it governs. Claude Code loads a rule file when it reads or edits one of those files; any other agent reads the file named below before it changes that area. The indexes after the list state each rule in one line.

- `.claude/rules/web.md`: frontend rules 1 to 10. Read for any change under `apps/web`.
- `.claude/rules/api.md`: the API conventions and domain rules 1, 3 to 8, 13, 14 and 18. Read for any change under `apps/api`.
- `.claude/rules/admin-surfaces.md`: domain rule 11. Read when you touch the admin area, the docs, metrics or support surfaces, or the web proxy.
- `.claude/rules/auth-billing.md`: domain rule 9. Read when you touch sign in, registration, sessions, tokens, the team, billing or the trial.
- `.claude/rules/keywords.md`: domain rules 2, 15, 22 and 25. Read when you touch keywords, keyword fields, keyword imports, competitors or the metadata page.
- `.claude/rules/keyword-discovery.md`: domain rule 26. Read when you touch discovered keywords.
- `.claude/rules/actions.md`: domain rule 12. Read when you touch the Action Center.
- `.claude/rules/screenshots.md`: domain rule 16. Read when you touch screenshots or their captions.
- `.claude/rules/alerts.md`: domain rules 17, 19 and 24. Read when you touch alerts, alert emails or the alert feed.
- `.claude/rules/charts.md`: domain rule 20. Read when you touch top charts or category ranks.
- `.claude/rules/reviews.md`: domain rule 21. Read when you touch reviews, replies or translations.
- `.claude/rules/store-connect.md`: domain rule 23. Read when you touch store console connections or the funnel.
- `.claude/rules/checklist.md`: domain rule 27. Read when you touch the workspace checklist.
- `.claude/rules/mcp.md`: shared code rule 7 and domain rule 10. Read when you touch either MCP transport or the tool catalog.

### Frontend rules index

1. One transport: only `src/lib/api/` talks to the API, typed by `@asobeast/shared`; only the proxy reads a request body, through `readBoundedBody`.
2. The query cache owns freshness: keys, options and invalidation live in `src/lib/queries.ts`; `router.refresh()` is banned.
3. The URL is the state through `nuqs` parsers in `src/lib/search-params.ts`; transient input and per viewer preferences are the listed exceptions.
4. Every segment has `loading.tsx` and `error.tsx`; `useSuspenseQuery` sits under a local `Suspense`; on demand dialogs, sheets and popovers read with `useQuery` and `InlineQueryError`.
5. Domain rendering: a `null` position renders `>100` or `>200`, never `0`; dates are UTC; no engine worded date times or storefront names; prices go through `formatPrice`.
6. Theming and accessibility: focus never falls to `body`, a running request keeps its control focusable with `aria-disabled`, and text sits in its own `<span>` so a page translator cannot break React.
7. The shell is a sidebar, and each page picks one width utility from `src/styles/layout.css`.
8. Charts go through the chart system in `src/components/charts/`.
9. Tables go through the table kit in `components/data-table/`; judged numbers go through `lib/grade.ts`, the figure in ink with its grade word in the accessible name.
10. Orange is action, blue is information, status keeps its own hues; text takes a token colour, never an opacity modifier.

### Domain rules index

1. Both stores are live; Google Play has no subtitle and no keyword field, and its short description is the equivalent surface.
2. The iOS keyword field exists once per localization, is counted with `countChars`, stored only in `KeywordField`, written only by `KeywordFieldWriter` and edited only on the metadata page.
3. Without a proxy pool, store workers run at concurrency 1 behind `SCRAPE_ITUNES_RPM` and `SCRAPE_GPLAY_RPM`; with one, concurrency rises to `PROXY_WORKER_MAX_CONCURRENCY`; never call a store in bulk outside the queue.
4. `Keyword`, `KeywordMetric` and `SerpEntry` are global, so one search serves every tenant; the tracking relation is tenant owned; every listing read is scoped through `apps/api/src/apps/listing.ts`.
5. Opportunity is derived in the read layer, never stored.
6. A position is 1 based; `null` means checked and not found, and the row is stored anyway.
7. Tenancy is enforced by row level security: service code never puts `workspaceId` in a `where`, and cross tenant work goes through `CrossTenantAccess`.
8. Scrapers break: a parse failure fails the job, never request handling; a route that waits on a store uses `StoreDeadlineInterceptor`.
9. Authentication is mandatory, self registration never joins a workspace that holds data, credential and team routes are `@SessionOnly()`, and a mailbox gets one Stripe trial ever.
10. Both MCP surfaces need a token; read tools are `GET`; write tools live only in `MCP_WRITE_TOOLS` and list only for a write scoped token.
11. The admin surfaces carry their own gate and answer `404`; the platform operator is `isPlatformOperator`, never `role === 'owner'`.
12. The Action Center is deterministic; a fingerprint excludes every volatile magnitude, and AI only summarizes an existing action.
13. A request never waits on Redis through a BullMQ connection; it goes through `FailFastRedis`, and boot and shutdown never wait on Redis.
14. Every AI call goes through `AiGateway` and spends the monthly allowance; a spent allowance answers `429`, never `402`.
15. A keyword import is validated by the server and only adds or resumes keywords.
16. Screenshot captions are read on the host, never by OpenAI or a downloaded language pack, and are never an indexed field.
17. Alert emails carry one click unsubscribe; account and billing emails are transactional.
18. A route that spends store capacity carries `@SpendsStoreCapacity()` and spends one `ON_DEMAND_ACTIONS` allowance, after every check that can refuse where the service takes the spend as a callback.
19. An email alert recipient confirms the address before anything is mailed to it.
20. A chart is captured once a day for every workspace, only through `ChartCaptureService.captureToday`.
21. A review reply is a stored row the owner approves; the store is written only by `ReviewReplyPoster` on a person's click.
22. The keyword breakdown judges with coverage's own functions and reads stored rows only.
23. A console key is sealed and owner only; the funnel comes from the store's own report and is never estimated.
24. The alert feed reads what the run recorded, never what a channel received.
25. A keyword's class comes from one matcher, `classifyKeyword`; only the owner overrides it.
26. Keyword discovery never scores, never writes a position history and never spends keyword room.
27. The workspace checklist is derived on read; the workspace stores only a goal and a dismissal.

## Tech stack

- **Monorepo:** pnpm workspaces and Turborepo, Node.js 24.9+ (images build on `node:24-alpine`; Jest runs with `--experimental-vm-modules` to `require()` the ESM only NestJS 12 packages), TypeScript strict everywhere.
- **apps/api:** NestJS, Prisma with PostgreSQL 18, BullMQ with Redis 8, Jest and Supertest.
- **apps/web:** Next.js App Router with Tailwind, talking to the API over HTTP; Vitest and Playwright.
- **apps/mcp:** stdio MCP server built with tsup, tested with Vitest. Both MCP surfaces run `@modelcontextprotocol/server@2.4.0` and serve protocol `2026-07-28` alongside the 2025 revisions.
- **packages/shared** (`@asobeast/shared`, tsup cjs, esm and dts), **packages/mcp-tools** (`@asobeast/mcp-tools`), **packages/typescript-config**.
- Scraping: `@perttu/app-store-scraper` and `@mradex77/google-play-scraper`, both behind the `StoreProvider` interface.
- Screenshot text: `tesseract.js` 7 with bundled `@tesseract.js-data/*` models and `sharp`, behind the `OcrEngine` interface.
- Docker Compose for development services and self hosting.

## Repository layout

```text
apps/api/src/        one folder per NestJS feature module, for example auth, apps, keywords, rankings,
                     charts, reviews, alerts, actions, store-connect, mcp, jobs; prisma/ and test/ beside src
apps/web/src/        app/ (App Router segments), components/ (ui/ owned shadcn primitives, data-table/,
                     layout/, one folder per feature), lib/ (api/ transport, queries.ts, search-params.ts)
apps/web/e2e/        Playwright specs and mock-api.mts, a typed mock API on port 4100
apps/mcp/src/        stdio MCP server; tools/ registers the shared catalog
packages/shared/     contract types, Store union, URL parser, constants, setup contract
packages/mcp-tools/  the one MCP tool catalog both transports register
docs/                Mintlify site published at docs.asobeast.com
docker-compose*.yml  dev services, the built stack, the published image stack, the tunnel and Portainer overlays
```

## Commands (run from the repo root)

```bash
pnpm env:dev                    # writes .env, apps/api/.env and apps/web/.env from the examples; keeps existing files
docker compose -f docker-compose.dev.yml up -d
pnpm install
pnpm dev                        # shared (tsup watch) + api + web; pnpm --filter api dev or --filter web dev for one
pnpm build
pnpm lint && pnpm test          # lint never writes; pnpm --filter api lint:fix is the only lint that rewrites
pnpm --filter api test:e2e      # supertest e2e, providers mocked, separate REDIS_DB
pnpm --filter api test:isolation # two workspace tenancy isolation suite, blocking in CI
pnpm --filter web test:e2e      # playwright against the mock api on port 4100
pnpm --filter web exec playwright install chromium webkit  # once, before the first browser run
pnpm --filter api db:migrate    # prisma migrate dev
pnpm --filter api db:studio
pnpm format:check               # prettier; the pre-commit hook formats staged files
```

## Cloud sessions

`scripts/cloud/setup.sh` provisions a Claude Code cloud environment (Node 24, Compose images), and the SessionStart hook in `.claude/settings.json` runs `scripts/cloud/session-start.sh`, which starts `dockerd` and `docker-compose.dev.yml` (PostgreSQL 18 on 5433, Redis 8 on 6380), runs `pnpm env:dev`, installs, generates the Prisma client and migrates; it exits at once unless `CLAUDE_CODE_REMOTE=true`. Lint, unit tests, build, API e2e, the isolation suite and the Compose drills run there; the web Playwright suite needs `cdn.playwright.dev` added to the network allowlist. Use **Trusted** network access and never put a real secret in the environment's variables. The VM (about 4 vCPU, 16 GB) is not for load benchmarks.

## Git conventions (strict)

- Conventional commits: `type(scope): subject`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`, `revert`.
- Scopes: `repo` (workspace level), `api`, `web`, `mcp`, `shared`, `docker`, `ci`, `docs` (the Mintlify site), `deps`, `deps-dev`, and the API domain scopes `db`, `providers`, `apps`, `keywords`, `rankings`, `scoring`, `competitors`, `analytics`, `jobs`, `audit`, `metadata`, `changes`, `alerts`, `auth`, `actions`, which always mean code inside `apps/api`.
- Subject: imperative, lowercase, no trailing period, at most 72 characters. One logical change per commit; the body says only what a reviewer cannot infer from the diff.
- Before every commit: `pnpm lint && pnpm test` green, plus `pnpm build` when configs or dependencies changed.
- Before a pull request is ready, in this order: run the code review skills from `agent-skills` and make sure everything is correct, every edge case is handled, there are no errors or bugs and the code quality is very good; run `/open-code-review:review` against `main`; then have a Sonnet 5.5 subagent run manual QA of the plan's functionality and its edge cases, through `agent-browser` where it can. A fix made in any pass reruns both code reviews, so the last review covers the final diff. Before each release: the same full review over everything since the last tag, plus regression testing through `dogfood` and `playwright-cli`. `CONTRIBUTING.md` holds the details.
- A pull request description follows `.github/PULL_REQUEST_TEMPLATE.md` and fits on one screen (about 250 words outside `<details>`): what a person notices first, at least one screenshot (`gh pr create --attach` or `gh pr edit --attach`, `gh` 2.99 or later; from a fork see `CONTRIBUTING.md`) whenever the web app looks or behaves differently, at most three points worth a look, and what was checked by hand and what was not. It becomes the squash commit body, so it never copies CI pass counts or restates the implementation.
- Never commit `.env` files, `node_modules`, `dist`, `.next` or `.turbo`. The `pre-commit` hook formats staged files and `commit-msg` runs commitlint; `--no-verify` only in an emergency, explained in the pull request.

### Release policy

- `1.x` takes normal feature work: a `feat` bumps the minor, a `fix` the patch.
- Every `fix` includes a regression test written from the reported symptom, observed failing for that reason before the fix: a unit spec for logic, API e2e for a contract or guard, Playwright for a user visible flow.
- Every release a person notices gets a plain language entry in `apps/web/src/lib/whats-new/` (no code, paths, variables, issue numbers or internal names; `release-notes.test.ts` enforces it). A `feat` the interface shows adds its line under the next version in the same pull request; an entry newer than the running version stays hidden until Release Please bumps it, and the release pull request corrects its date. `CHANGELOG.md` stays the technical record.
- Release Please owns tags, versions and `CHANGELOG.md`; never cut a release by hand while the pipeline is healthy. A forced manual release bumps the six manifests and `.release-please-manifest.json` together and pushes the matching `v` tag; `.github/scripts/verify-release-state.sh` fails the Release workflow otherwise (`docs/operations/release-recovery.mdx`).
- The upgrade and backup drills start from `UPGRADE_FROM_TAG` (`v1.0.0`), so every drill applies each migration added since the first release; CI skips the drill steps when the baseline is the commit under test.

## Coding conventions

- TypeScript `strict: true` everywhere, extending `@asobeast/typescript-config`. No `any`, except where an untyped scraper payload enters the provider layer and is mapped to a typed structure at once.
- **No comments of any kind**, in source and tests alike: no line or block comments, JSDoc or TODOs. Names, types and extracted functions explain the code; a why that fits nowhere else goes in the documentation site or the pull request. CodeRabbit flags every comment.
- Controllers thin, services own the logic, scoring functions pure and unit tested.
- All dates UTC; daily granularity uses Postgres `date` (`@db.Date`); "today" is the UTC date.
- No alternative ORMs, queues, HTTP clients, package managers or task runners; the stack is fixed.

### Code organization and file size

Decompose by responsibility, not by syntactic kind: the target is fewer concepts per file, not fewer lines or more files.

- Soft budget: source files about 400 lines, functions about 80 (api) or 150 (web). An ESLint warning means find the seam, not pad to the limit. Tests and `components/ui/*` are exempt.
- Extract code that is reused across modules (to `@asobeast/shared`, a domain helper or `lib/`), that is a nameable responsibility, or that is pure logic worth its own spec. Colocate code used in one place; no dumping ground `const.ts`, `types.ts` or `utils.ts` (shared contract types are the exception).
- An oversized NestJS service becomes several focused providers in the same module; an oversized React component becomes sub-components, column definitions and pure formatters in its feature folder. A large cohesive module of small pure functions is fine.
- `max-params` warnings on NestJS DI constructors are accepted; answer a long constructor by splitting the provider, never by grouping dependencies.
- A refactor and a behaviour change are separate commits; a refactor keeps existing assertions identical.

### Shared code rules

1. Every request or response shape the frontend consumes is a contract type in `@asobeast/shared`; API DTOs implement it and the web types its calls with it. Prisma generated types never leave `apps/api`.
2. `@asobeast/shared` owns the `Store` union (values identical to the Prisma enum), the store URL parser and shared normalization helpers, and stays dependency light and runtime agnostic: no Nest, Next or Node only APIs.
3. `@asobeast/shared` stays a compiled package (tsup, cjs, esm and dts), never raw TS exports, because NestJS's CommonJS build cannot consume them.
4. Internal dependencies use `workspace:*`; Turborepo's `build` depends on `^build`.
5. Never import across packages by relative path.
6. `apps/mcp` is a consumer like the web app: HTTP only, typed with `@asobeast/shared`, no Prisma, Nest or scraper imports.

## Documentation and dependencies

- `/docs` is the Mintlify site, not a workspace; the Mintlify CLI runs only through `pnpm dlx` (via `scripts/mint.sh`). Preview with `pnpm docs:dev`, check with `pnpm docs:check`, lint prose with `pnpm docs:prose` and format with `pnpm docs:format` (Prettier skips `docs/**/*.mdx`).
- Every page has a `title` and a `description`; headings are sentence case. Docs and `README.md` use no dash punctuation (no em dash, en dash or spaced hyphen standing in for a comma or colon; hyphenated compounds stay), enforced by `Dashes.yml` and `pnpm check:readme-prose`.
- A fact lives on exactly one page. `docs/concepts/` owns the domain rules, `docs/integrations/` the console connections, `docs/guides/screenshot-captions.mdx` and `docs/concepts/stores.mdx` the caption rules, the Store funnel guide what the funnel numbers mean. `README.md` stays short and links to the docs instead of repeating them. Commit the site with the `docs` scope and `README.md`, `CONTRIBUTING.md`, `AGENTS.md` and `.claude/rules/` with `repo`.
- A change to a controller, a DTO or a response shape re-runs `pnpm docs:openapi`; Release Please bumps its `info.version`, so a release needs no recapture. `pnpm check:release-versions` keeps every versioned file on the release version.
- Every `https://docs.asobeast.com` link in `apps/web/src` is one literal URL, checked by `apps/web/src/lib/docs-links.test.ts`; renaming a heading updates its links in the same commit.
- Pins Dependabot cannot see are bumped by hand: `MINT_VERSION` in `scripts/mint.sh`, `VALE_VERSION`, `MCP_PUBLISHER_VERSION`, `RCLONE_VERSION` and `AGE_VERSION` in the workflows (each with its checksum), `cloudflared` in `docker-compose.tunnel.yml`, the `ASOBEAST_IMAGE_TAG` default in `docker-compose.pull.yml` (the current release) and the `mcr.microsoft.com/playwright` tag in `ci.yml`, which `pnpm check:playwright-image` holds to `@playwright/test`. CI fails any Compose image on `latest`.
- `overrides` in `pnpm-workspace.yaml` hold only transitive pins a direct dependency cannot deliver yet; drop one as soon as its parent ships the fix, and validate a new one with `pnpm build`, `prisma validate` and a from scratch `prisma migrate deploy`.
- Dependabot patch and minor updates merge on their own behind the required checks; majors wait for a person. `pmOnFail: ignore` keeps `pnpm-lock.yaml` one YAML document, so run pnpm through corepack.

## Environment variables

- `apps/api/.env.example`, `apps/web/.env.example` and the root `.env.example` (Compose only) are the authoritative lists. `docs/configuration/reference.mdx` documents the API and Compose variables and `docs/configuration/web.mdx` the web ones; change the page in the same commit. `pnpm check:env-documented` fails CI when an API variable is missing from the reference or the reference names one its example does not declare (the root `.env.example` for the Compose only section).
- In an example file, a variable whose default is empty carries its comment on the line above it, never after it, because Compose reads `KEY=   # note` as the value `# note`; `pnpm check:compose-env` enforces it.
- Read a variable's comment in its `.env.example` before relying on its default: many refuse to boot or warn in production.

## What NOT to do

- No breaking change to the HTTP contract, the `@asobeast/shared` contract types or the MCP tool surface inside `1.x`; add alongside instead.
- No hand cut release while the pipeline is healthy; no `fix` without a regression test observed failing first.
- No store calls in tests; providers are mocked in unit and e2e tests.
- No manual SQL migrations; always `prisma migrate dev`.
- No scraper imports outside the `StoreProvider` interface.
- No OpenAI call and no CDN language download to read screenshot text; no screenshot caption in `uncovered`, the keyword field suggestion or an Action Center rule.
- No MCP tool that changes data outside `MCP_WRITE_TOOLS`, none listed to a token that is not write scoped, and none that calls a route the web app does not already use.
- No `KeywordMetric` or `KeywordRanking` written by a discovery check, and no discovery check on a competitor or a delisted app.
- No keyword field editor outside the metadata page, and no keyword field written outside `KeywordFieldWriter`; the keywords page only reports.
- No market added by guessing availability; suggestions come from declared languages and a market is seeded only by `MarketSeedService`.
- No chart fetched outside `ChartCaptureService.captureToday`, and no `CategoryRank` written from a provider call.
- No console credential read outside `StoreConnectionService.openAppStore` and `openPlay`, no store report request outside the `store-connect` queue, and no estimate where Apple or Google report nothing.
- No review reply written outside `ReviewRepliesService` and `ReviewReplyAssistant`, no review translation written outside `ReviewTranslator`, no review reply posted outside `ReviewReplyPoster` or without a person's click, and no AI draft or translation that bypasses `AiGateway`.
- No trial stamped on a workspace outside the Stripe projection, no trial offered outside `TrialOffers`, no read of `TrialClaim` outside `CrossTenantAccess`.
- No sentence on the billing wall, the trial bar, the trust row or the FAQ outside `lib/plan-choice.ts`, `lib/order-summary.ts`, `lib/paywall-faq.ts` and `planRenewalTerms` in `@asobeast/shared`; no claim on the wall the documentation does not make; no Checkout Elements and no `payment_method_types` on a session while the instance sells through Managed Payments.
- No comments inside code. DRY, KISS, clean code.
