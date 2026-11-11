---
paths:
  - "apps/api/src/keyword-discovery/**"
  - "apps/web/src/components/keywords/discovery/**"
  - "apps/web/src/lib/keyword-discoveries.ts"
  - "apps/web/src/lib/api/keyword-discoveries.ts"
---

# Keyword discovery rules

## Domain rule 26: Keyword discovery lists what an app ranks for and does not track, and it never scores, never writes a position history and never spends keyword room

The row:

- `KeywordDiscovery` (RLS, `@@id([appId, keywordId])`) holds one proposed phrase per app. `source` is validated against `DISCOVERY_SOURCES` (`keywordSourceOf`, `keyword-discovery/discovery-pool.ts`, maps it to a `KeywordSource`); `depth` and `checkedOn` are null until checked; `queuedAt` is the weekly reservation; `seenAt` is stamped whenever the pool proposes the phrase and drives the 60 day retention (`KEYWORD_DISCOVERY_DAYS`); `dismissedAt` is permanent, and retention never prunes a dismissed row, because it keeps the phrase out of the pool.

The pool:

- `buildPool` over `DiscoveryCandidates.forMarket`: each market's listing; for the home market only, competitors' home titles and subtitles and review phrases of at least `MIN_REVIEW_PHRASE_WORDS` (two) words; for the App Store only, Apple's popularity weeks of the app's genre; and phrases the workspace tracks for other apps. Minus every phrase the app tracks in that market (active or paused) and every dismissed one, cut to `DISCOVERY_POOL_LIMIT` per market.
- `DiscoveryPoolStore` writes it, keeps a checked row's relevance with its ranking evidence, and never re-proposes or un-dismisses a dismissed phrase.

Checking:

- A position comes free from today's or yesterday's `SerpEntry` capture (`DiscoveryCaptures`, `depth` 50; a capture without the app is not final and the row stays due), or from one deferred `DISCOVER_KEYWORD` search to `RANK_DEPTH`. At most `DISCOVERY_CHECKS_PER_RUN` searches per app per ISO week, counted by `queuedAt` and reserved under a per app advisory lock (`DISCOVERY_LOCK`); a constant, not a plan limit, because it protects the host address. A row is due again after `DISCOVERY_RECHECK_DAYS`.
- `KeywordDiscoveryPlanner.plan` is the one entry for the weekly `CRON_DISCOVERY` sweep (`KeywordDiscoverySweep`, every still listed primary app of the workspaces `ActiveWorkspaces.forDailyRun` names, no spend) and for `POST /apps/{id}/keyword-discoveries/refresh`, which spends `spider` only when a check is queued and releases the reservation when the spend or enqueue fails. A delisted app and a market in `unlistedMarkets` get no search; only markets `loadAppMarkets` names are searched. A free capture that ranks a row is auto tracked as a check would be.
- `DiscoveryCheck` runs in `StoreJobsHandler`, gated by `CollectionEligibility.forWorkspace`, searches through `SerpCapture`, stores the capture only when `CrossTenantAccess` counts no active tracker of the keyword, and never writes a `KeywordRanking` or `KeywordMetric`. No discovery check ever runs for a competitor.

Tracking:

- `DiscoveryTracker.trackRows`: `planSeed` per country against the keyword room, one `QuotaService.admitKeywordMarkets`, a `KeywordRanking` row for an observation of today or yesterday (so the table never shows Checking for a known position), `FirstPositionChecks` for the rest, then `enqueueFirstScores` and `MarketListingRequests`. A row over the room stays a discovery (`skipped`).
- A discovery is hidden while the app tracks its keyword (`keyword: { tracked: { none: { appId } } }`), so untracking brings it back. `App.autoTrackRanked` lives on `App`, not `AppSetup`: while on, a check that finds the app ranking tracks the phrase, keeping it a discovery when admission is refused.

Reporting:

- Traffic comes from a stored `KeywordMetric`, or Apple's listed popularity for an unscored App Store term; opportunity also needs a stored difficulty, so Opportunities lists scored keywords only.
- `GET /jobs/budget` reports weekly checks in an optional `discovery` block per store and in total, never in `total` or `utilization`; the weekly job is not part of `AppRunStatusService`, the capacity report or the operator metrics.
- The MCP read tool `keyword_discoveries` wraps the list; no MCP write tool tracks a discovery.
