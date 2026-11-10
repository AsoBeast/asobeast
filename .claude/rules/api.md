---
paths:
  - "apps/api/**"
---

# API rules

## Conventions

- Every controller input is a `class-validator` DTO; the global `ValidationPipe` runs with `whitelist: true`.
- An error envelope's `path` is the request path without its query (`pathWithoutQuery`, `common/request-path.ts`; Nest's unknown route message is cut the same way by `withoutQueryEcho`), so a credential put in a URL never comes back in a body. Anything that builds an `ApiErrorEnvelope` for a request calls `pathWithoutQuery`; the web proxy's own envelope uses `nextUrl.pathname`.
- Text reaches a service only through `@Param`, `@Query` or `@Body`. The global `StorableTextPipe` runs before `ValidationPipe` and refuses a NUL (`404` in a path id, `400` elsewhere; PostgreSQL cannot store it), an unpaired surrogate (`400`; the Prisma protocol cannot carry it) and nesting deeper than `MAX_NESTING_DEPTH` (64, `400`, or `ValidationPipe` throws a `RangeError` as a `500`).
- A field that is only hashed (a password, a one time token) carries `@HashedOnly()`, which `@IsPassword()` applies. The mark survives `extends` but not `PartialType`, `PickType` or `OmitType`, which must apply it again.
- A controller never reads `req.params`, `req.query` or `req.body`; `McpController` is the one exception, because its tool arguments dispatch in process to `GET` routes behind the same pipe. Never map the database error in `AllExceptionsFilter`: server sourced text stays a visible `500`.
- Only `store-providers/` imports a scraper library, behind `StoreProvider`. Raw scraper payloads are stored in `raw` Json columns so a fixed parser can reprocess them.
- Every email is a React Email template rendered by `renderEmail` inside `EmailLayout` (`mail/`), never string-built HTML. A template is a pure component whose props carry everything it shows, the web origin included; colours come from `email-theme.ts`.
- A migration never assumes `_prisma_migrations` exists: `prisma migrate dev` replays into a shadow database without it, so a read of it is guarded by `to_regclass('_prisma_migrations')` in PL/pgSQL (`test/migration-replay.e2e-spec.ts` replays the history). A released migration is edited only to make it replayable, together with a forward migration that rewrites its stored checksum (as `20261008092139_record_plain_play_whats_new_checksum` does); a database holding the released checksum runs `pnpm --filter api db:deploy` once first.
- `installs` is `BigInt`; its JSON serialization is patched in `main.ts`.

## Domain rule 1: Both stores are live

- `SUPPORTED_STORES`, the Prisma enum, the `Store` union and the URL parser cover App Store and Google Play. The 501 `StoreNotSupportedError` path stays for a future store.
- Play indexes title (30), short description (80) and long description (4000). It has no subtitle and no keyword field, so both stay Apple-only everywhere: types, lints, audit weight 0, hidden in the web.
- Play's short description (`summary`) is the equivalent surface: auto-tracked (`DESCRIPTION` source), linted (`lintShortDescription`) and coverage-checked.

## Domain rule 3: Rate limits

- The `appstore` worker runs at concurrency 1 behind `SCRAPE_ITUNES_RPM` (default 15; iTunes tolerates about 20 a minute per IP). The `gplay` worker runs at concurrency 1 behind `SCRAPE_GPLAY_RPM` (default 10), which spaces job starts, because Play is stricter.
- Request fan-out: a Play score job makes 12 to 20 requests (a search, 1 to 9 suggest probes, 10 `getApp` enrichments), an App Store score job 3 to 11 (a search, 1 to 9 probes, a continuation lookup); a depth 200 Play rank job makes about eight, an Apple one makes one.
- Never call a store in bulk outside the queue. The only exceptions are small user initiated lookups (keyword suggestions, a name search, similar apps), each behind an hourly allowance.

## Domain rule 4: One app, per-market keyword tracking; one search serves everyone, including across tenants

Shared rows and quota:

- `Keyword` (scoped by `text, store, country`), `KeywordMetric` and `SerpEntry` are global and carry no policy, so one search serves every workspace tracking the phrase. The tracking relation and the recorded position are tenant owned.
- `checkKeyword` searches `keyword.country` (not `app.country`), reads its trackers through the escape hatch, keeps only the workspaces `CollectionEligibility` still collects for (so a suspended, unentitled or over limit workspace gets no fresh rows from another tenant's search), and records the primary app and every competitor from that one search. The same phrase in two markets is two keyword rows and two searches.
- Quota counts keyword-market pairs per workspace, never global rows. Each market multiplies daily searches against the same RPM budget; `GET /jobs/budget` estimates the fan-out for the settings budget card.
- `SerpEntry` keeps the top `SERP_CAPTURE_DEPTH` results; a top 10 reader (entrants, movers, volatility, top 10 competitors, discovery) filters with `TOP_TEN_ROWS` (`rankings/top-ten.ts`).
- A phrase nobody tracks is searched only by keyword discovery (domain rule 26), which writes the shared capture, never a `KeywordRanking`, and only while no workspace tracks the phrase, because a same day capture would become the daily run's entrant baseline (`entrantBaseline`).

Markets:

- A market is suggested, never guessed. `GET /apps/{id}/market-suggestions` (`MarketSuggestionsService`) joins the languages the newest home snapshot declares (`extractRawFacts(...).languages`, normalized by `declaredLanguage`) with `storefrontsForLanguages`, which answers the first localization in a storefront's read order whose language is declared, with its role. Never English, never the home market, and an empty list for Google Play or a competitor.
- `POST /apps/{id}/market-seed` (`MarketSeedService`) captures the market listing with `refreshListing`, extracts `seedCandidates` (`keywords/listing-seed.ts`: the sources and `MARKET_SEED_LIMIT` of the home import's `syncFromSnapshot`, shipped localizations included), leaves phrases the app already tracks there (active or paused) as they are, plans the rest with `planSeed` inside `admitKeywordMarkets`, reports what does not fit as `skipped` (never 403), then calls `FirstPositionChecks.schedule`, `enqueueFirstScores` and `MarketListingRequests.request`. A storefront without the app answers `unavailable` and writes nothing.
- Every path that starts tracking (a manual add, an import, a seed, `KeywordFieldWriter.announce`) queues the first position check before the first score, because the store queues are FIFO at concurrency 1 and a score costs 3 to 11 requests to a check's one. The writer checks only the keywords its save activated.
- Category ranks, reviews, the ratings history and auto-tracked keywords stay on the home market. Top charts read any storefront through `GET /charts`, and `checkCategory` records from the same `ChartCapture`.

Listings and localizations:

- `AppSnapshot.country` and `ChangeEvent.country` are nullable and `NULL` is home; only `apps/listing.ts` says so, and every read carries `HOME_LISTING`, `HOME_EVENTS` or a market filter from it (`listing-reads.guard.spec.ts` fails the build otherwise). `.localization` is nullable the same way (`NULL` is the storefront's default) and every helper scopes to it unless given a tag; `eventsOfMarket` alone reads every localization of a market, for the changes timeline.
- A market listing is captured for the app and its competitors in every market where the primary app tracks keywords (`REFRESH_APP` with a `country`, counted in the `apps` stage as `marketListings`). Coverage and relevance judge a keyword against its market's listing and fall back to home.
- For an App Store storefront whose default is English other than U.S., `nativeLocalizations(country)` names the native localizations it also reads. `LocalizedListingCapture` asks for each after the default capture, stores one only when the store serves it (`servesLocalization`) or one was stored before, records its changes without an alert and its screenshots in its own language, and never fails the default capture. The first native snapshot records its localization as `detected` (`recordAppLocalizations`); later captures record nothing, so a removal sticks until detection runs.
- `LocalizedListingCapture` reads `capturedLocalizations(market, shipped)` (`apps/market-localizations.ts`): the native localizations plus every shipped localization the storefront reads besides its default (`shippedLocalizations` always counts home), for a primary app only, counted by `localizationReads`. `latestLocalizedTexts` and the market switcher read only localizations a market still captures; `listingTexts` stays native only for the home auto tracking.
- A market capture of a primary App Store app also records the market's default localization as `detected` when `provenDefaultLocalization` (`apps/market-default-localization.ts`) proves the store serves it: the listing differs, by `servesLocalization`, from the newest home listing and from every other localization read in that capture. `MarketLocalizationRecorder` runs after the capture, records nothing when a lookup failed, never records home and never fails the capture. A market's default is never a probe candidate; a removed one returns with the next capture that proves it.

Localization detection and judging:

- The first capture of a market listing for a primary app calls `LocalizationDetection.request` without spending, adding that market to the probe. `CRON_LOCALIZATION_SWEEP` repeats it weekly through `LocalizationSweep` (`jobs/`) for every primary App Store app of the workspaces the daily run collects for.
- `POST /apps/{id}/localizations/detect` queues one deferred `DETECT_LOCALIZATION` job per `detectionCandidates` entry (a localization an app market reads, not shipped, whose language the home listing supports). `LocalizationDetection.probe` calls `getApp(…, localization)` and records `detected` only when the text differs from both the probe market's default and the home listing, because a storefront answers an unshipped localization with its primary text. A localization identical to either is invisible, which is why `manual` exists.
- Coverage judges a keyword within each localization of its market (`judgeFields`), keyword fields included (`judgingSurfaces`, `metadata/listing-surfaces.ts`; a market other than home gets a field cell only once a field it reads is saved). Auto tracking interleaves the home localizations native first, and `GET /jobs/budget` counts one read per captured localization as `localizations`.
- The lookup and the product page take a localization in different formats (`app-store-languages.ts`); a malformed lookup `lang` is an HTTP 400, so the map is exhaustive and tested.

## Domain rule 5: Opportunity is derived, never stored

`KeywordMetric` stores traffic and difficulty. Opportunity is computed in the read layer only, as `(min(volume, 30) / 30) ^ 1.25 * (100 - difficulty)` (`scoring/opportunity.ts`), the same for every app tracking the keyword. Relevance is reported beside it and never multiplied in (`scoring/keyword-opportunity.ts`).

## Domain rule 6: Position semantics

1 based; `null` means checked and not found within `depth` (default 200). Store the row even when `null`.

## Domain rule 7: Tenancy is enforced by the database, not by remembering to filter

- Every tenant-owned table has a `tenant_isolation` policy on `app.workspace_id`. Every Prisma operation runs in a transaction that calls `app_enter_workspace` and switches to the non-owner `asobeast_app` role, because a superuser or the table owner bypasses policies. A query with no workspace in scope returns nothing.
- Service code never puts `workspaceId` in a `where`: it takes the workspace from `WorkspaceContext` to write and lets the policies scope reads.
- Cross-tenant work (account resolution, the scheduled pipeline, retention, operator health) goes through `CrossTenantAccess`, whose one method demands a written justification. `DEFAULT_WORKSPACE_ID` is a bootstrap value; an ESLint rule fails it in any other service. Migrations and the seed run as a role that bypasses policies.
- In-memory state keyed by a tenant-owned id (a single flight map) is keyed by `WorkspaceContext.require(...)` plus the id, because a map hit answers before any policy runs (`ActionsAiService`); a map consulted only after a policy-scoped read (`AuditService.runAi`) is equivalent.
- `AppSetup` (RLS, `@@id([appId])`) holds a primary app's guided setup; `status` and `skipped` are validated in code against `SETUP_STATUSES` and `SETUP_STEPS`, and the portfolio summarizes it with `setupSummary`. `PATCH /apps/{id}/setup` checks `selectedMarkets` with `assertStorefront` in `AppSetupService.update`, not in the DTO, which does not know the store: a code that is neither already held nor the home country is a `400`, so writing back a list that was read never fails.

## Domain rule 8: Scrapers break

- A parse failure fails the job (BullMQ retries with backoff), never request handling.
- A route that waits on a store carries `@UseInterceptors(StoreDeadlineInterceptor)`. Providers pass its `AbortSignal` to the scraper and stop retrying, so the request answers the store's `502` within `ON_DEMAND_STORE_DEADLINE_MS` (20 s, under the MCP gateway's 25 s and the web proxy's 30 s) and the cancelled call writes nothing. A late answer is discarded, a proxy pool lease waits no longer than the deadline, a deadline abort never counts against an endpoint, and pool initialization runs outside the scope (`outsideStoreDeadline`).
- Queued work keeps its retries; an App Store attempt is abandoned after 15 s and retried, never trusted.
- A store job that meets an unavailable database (`isDatabaseUnavailable`, `prisma/database-fault.ts`) goes back to the queue delayed and spends no attempt until it is a day old (`BUSY_POOL_LIMIT_MS`); a database error never counts against a proxy endpoint.
- An app the store no longer lists is a fact, not a failure. In `ListingCaptureService`, `StoreAppNotFoundError` in the home storefront sets `App.delistedAt` (kept until the next home capture or import clears it) and a queued refresh finishes on it in every market. In any other storefront it adds the market to `App.unlistedMarkets` (removed by that market's next capture, never `delistedAt`, because many apps sell in some storefronts only). `AppRunStatusService` expects no listing for either, and the contract answers the optional `delistedAt` on the app detail, the app list, the competitor items and the portfolio.
- A not found read records either fact only when no capture of the same app and storefront stored a listing after the read began: `recordUnlisted` writes under `lockListing` (`apps/listing-lock.ts`, the advisory lock the capture takes before its snapshot). The same compare and set raises `app.delisted` or `app.unlisted_market` once through `ListingAlerts.listingLost`: a market only when a listing of it was stored before, for primary apps and competitors, in the capture's workspace scope, never failing the capture and never asking whether a channel listens.

## Domain rule 13: A request never waits on Redis through a BullMQ connection

- A BullMQ connection queues commands offline and retries forever, so a request behind it hangs until the proxy's 504. Every Redis read or counter on a request path goes through `FailFastRedis` (`redis/`, `enableOfflineQueue: false`, a 500 ms `commandTimeout`), and the call site picks the policy: `run` fails closed with `RedisUnavailableError` (503 and `Retry-After`), `runOpen` fails open with a fallback. Both cover only an unreachable or timed out Redis; an error reply such as `WRONGTYPE` is a bug and propagates.
- Fail closed what could be abused or queues work Redis must run: the authentication throttler, the recovery limiter, the on demand limiter. Fail open what only meters or decorates: plan request counters, the rejected credential count, abuse counting, run keys, operator metrics.
- Never read `queue.getBackend().client` on a request path; `/health` and the first run status do only because each races its own one second timer.
- Enqueueing still waits for Redis, a known and bounded gap, not a pattern: `redisConnection` gives every BullMQ connection the `reconnectDelay` backoff (50 ms steps, capped at 2 s) and `maxRetriesPerRequest: null`, so the first enqueue after Redis returns waits at most 2 s (`redis-outage.e2e-spec.ts`).
- `QueueErrorReporter` (`jobs/`) attaches an `'error'` listener to every discovered `Queue` and `WorkerHost` worker (without one BullMQ prints with `console.error`, outside the JSON log) and sends outages to the shared `RedisOutageLog`, so the API names an outage once every 30 s; other queue errors log at error level. Never attach a second listener per class or silence `console.error`.
- `AppRunStatusService` answers `GET /apps/{id}/run-status` from `AppSnapshot`, `KeywordRanking` and `CategoryRank` rows counted since the daily trigger (or UTC midnight once past) and never reads a queue. It answers `paused: true` when `CollectionEligibility.forWorkspace` refuses the workspace, keeps `state` and the counts as the rows give them, and adds no `RunState` value.
- Boot never waits on Redis: `BillingWorker` and `PipelineWorker` hand `registerSchedules()` to `registerInBackground` from `onModuleInit`, which never awaits it, reports through `reportQueueError` and retries every 30 s until it succeeds or the queue closes.
- Shutdown never waits on Redis. After three unanswered `FailFastRedis` pings (an error reply counts as an answer) `QueueShutdown` arms `HttpDrain` and force closes every worker, queue and flow producer before `@nestjs/bullmq` closes them gracefully; the shared config sets `forceDisconnectOnShutdown: false`. `UNREACHABLE_DRAIN_MS` (2 s) later `server.closeAllConnections()` cuts open requests, with a warning, because Bull Board sits on the force closed connections; with Redis answering nothing is armed. `PrismaService` disconnects in `onApplicationShutdown` (after the server and the workers), gives up after 2 s and never disconnects in `onModuleDestroy`. A signalled stop ends with `process.exit(0)` (`enableShutdownHooks` with `useProcessExit`, `graceful-shutdown.ts`), never by re-raising the signal, because the API is PID 1 in its container. Pinned by the `shutdown-database`, `redis-down-shutdown-database`, `graceful-exit` and `redis-down-shutdown-in-flight` e2e specs.

## Domain rule 14: Every AI call goes through `AiGateway` and spends the monthly allowance

- `OPENAI_CLIENT` is private to `AiModule`. A feature calls `AiGateway.spend`, or `reserve` when the request is accepted and `charge` when queued work runs, never the client. Reserve only after every check that can refuse, so a 4xx never costs a call.
- The allowance is `PLAN_LIMITS[plan].aiCallsPerMonth` per workspace per UTC month (`aiPeriodOf`), counted from the tenant-owned `AiCall` ledger (`reserved` and `counted` count, `released` does not); the meter on `GET /auth/plan` reads the same rows. A call counts when the model answered, usable or not (`UnusableAnswerError`), and is released when it never answered.
- A spent allowance answers `429` with `aiAllowance` and `Retry-After`, never `402`, because the web sends every 402 to `/upgrade`. Self hosted is unlimited unless `AI_CALLS_PER_MONTH` is set; a Stripe trial gets `TRIAL_AI_CALLS_PER_MONTH` whatever the plan.
- Every call asks for the one output ceiling `AI_MAX_OUTPUT_TOKENS` (default 16,384), because a reasoning model spends that budget before it answers; a feature never sets its own. A call someone waits on keeps the client's 60 s timeout; only a queued call (`background`, today the creative analysis) waits up to 180 s, in one SDK attempt, inside `CREATIVE_RUN_TIMEOUT_MS`.
- The creative analysis embeds every App Store and Google Play image as a data URL (`CreativeImages`, through `ScreenshotImageSource.readListed`), so the provider never downloads a store image. An image on another host keeps its address; a store image that cannot be downloaded fails the run with `LISTING_IMAGE_UNAVAILABLE`.
- `OPENAI_BASE_URL` points the client at any OpenAI compatible API. `createOpenAiClient` is its only reader, passes it explicitly (`null` when unset, so the SDK never reads the environment) and sends the OpenAI organization and project headers only to a host `aiProviderOf` names `openai`.

## Domain rule 18: A route that spends store capacity says so and spends an on-demand allowance

- A handler that reaches a store while the client waits, or queues store jobs a caller can repeat, carries `@SpendsStoreCapacity()` and spends one `OnDemandLimiter` action from `ON_DEMAND_ACTIONS` (`refresh`, `runDaily`, `score`, `suggestions`, `spider`, `importApp`, `addCompetitor`, `storeLookup`, `chartCapture`), sized per plan in `PLAN_LIMITS`. Self hosted runs with `onDemand: null`, unmetered.
- A new route uses the callback pattern: the service receives the spend and calls it after every check that can refuse and before the first store call or `queue.add`, so a 400, 403, 404 or a request with nothing to queue costs nothing. Refresh, localization detection, deep search, app import, competitor add, the market seed, the store search, the competitor suggestions and the chart capture already do; a deep search finds nothing when every lookup is stored today or still queued. Market availability, run daily and score still consume in the controller.
- Suggestions spend only when a store strategy has something to look up. `StoreSuggestions.plan` (`keywords/store-suggestions.ts`) reads every local input first and skips `search` without an active tracked keyword, `developer` without a developer id, and `competitorSearch` without a seed phrase: two or more words, not only its own competitor's brand words, shared phrases first, at most `COMPETITOR_SEED_LIMIT` (`CompetitorSearchPlanner`, `competitor-seeds.ts`). `suggestAround` (`keywords/store-hints.ts`) keeps the seeds that answered and rethrows only when all failed, so `ProxyEgress` still falls back on a block. `STORE_SUGGESTION_STRATEGIES` names the strategies.
- `storeLookup` (hourly) covers the name search (`GET /store/search`) and the similar apps half of `GET /apps/{id}/competitors/suggestions`; the keyword result half is free and still answers, with `similar: "unavailable"`, when the store fails or the allowance is spent.
- `pnpm check:rate-classes` sees only handlers that call `limiter.consume(`, so a new route that queues store jobs proves its allowance in its own e2e spec (pattern: `test/spider-capacity.e2e-spec.ts`).
- Deep search and localization probes ask `CollectionEligibility.forWorkspace` in `StoreJobsHandler`, inside their own workspace scope, before taking an egress endpoint; keyword jobs are judged per tracker by `forKeyword`. Localization detection spends `refresh` only once at least one `DETECT_LOCALIZATION` job was queued.
- Work a person starts to explore (deep search, localization probes) is queued with `DEFERRED_JOB_OPTIONS`, a BullMQ `priority`, so the unprioritized daily run jobs go first; daily run jobs never carry a priority.
