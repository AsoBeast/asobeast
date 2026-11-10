---
paths:
  - "apps/api/src/charts/**"
  - "apps/api/src/category-ranks/**"
  - "apps/web/src/app/**/charts/**"
  - "apps/web/src/components/top-charts/**"
---

# Top chart rules

## Domain rule 20: A chart is captured once a day for every workspace

Capturing:

- `ChartCapture` and `ChartEntry` are shared store tables with no policy, like `Keyword`; each entry keeps the listing its storefront showed that day.
- `ChartCaptureService.captureToday(key)` fetches only when today's capture is missing and never catches a store failure. App Store calls ask `fullDetail: false`; `CHART_DEPTH.APP_STORE` is 100 (the feed's maximum), Google Play 200.
- An empty feed is read against stored captures of the same chart (`admitEmpty`):
  - newest earlier capture with at least `SPARSE_CHART_ENTRIES` (10) entries, 1 to `IMPLAUSIBLE_LOOKBACK_DAYS` (7) days old: implausible, throw `StoreRequestError` on every attempt and on demand (502);
  - newest earlier capture already empty: store an empty capture at once;
  - otherwise a queued job stores the empty capture only on its last attempt (`isFinalAttempt`, passed from `StoreJobsHandler` through `checkCategory` as `CaptureOptions.finalAttempt`) and throws before, so a soft block is retried; `POST /charts/capture` stores nothing and answers 200 with `answeredNoApps: true` (`ChartListsNoAppsError`).
- A chart empty by nature (the Play paid Shopping chart) succeeds, is asked once a day after its first day, and gives `checkCategory` `null` positions.
- Searches and review feeds follow the same plausibility rule without the entry threshold. An App Store answer still empty on its job's last attempt settles through `settleOnLastAttempt` (`store-providers/result-plausibility.ts`): a warning, nothing written, a completed job. An empty Play answer is a soft block and fails at once.
- `captureToday` is single flight per process, keyed by chart key and UTC date, so two first captures in one process reach the store once and spend at most once (only a caller that passes a spend callback spends; the scheduled `checkCategory` capture passes none); a caller that joined a flight whose leader was refused before the store captures on its own allowance, while a store failure is shared. Across processes only the unique index keeps one capture.
- `POST /charts/capture` runs under the store deadline and spends `chartCapture` only when a store request happens.

Ranks and follows:

- `checkCategory` reads the capture and writes tenant-owned `CategoryRank` rows with its depth, never from a provider call.
- The daily run captures every chart kind of each category and the overall chart a tracked app sits in (`bucketsOf` over `CATEGORY_COLLECTIONS`), while `AppBucketRow.collections` (the app's price class plus grossing) decides which rank rows are written, so a free app is never judged against the paid chart. `rankedChartsOf`, `isRankedIn` and `rankedChartKey` (`category-ranks/ranked-charts.ts`) state that rule; the `categories` run stage expects exactly `CategoryRanksService.rankedCharts(appId)` (four charts for a free or paid app).
- A `ChartFollow` is tenant owned, one row per chart kind. The `chartFollows` quota counts categories (`countChartCategories`, a distinct read on `CHART_CATEGORY_COLUMNS`), so three kinds of one category cost one unit and `admit` lets a further kind through at the limit. `ChartFollowsService.buckets` schedules the oldest categories the plan has room for (`oldestCategories`, `charts/chart-category.ts`), deduplicated against the workspace's app buckets in the fan out and `GET /jobs/budget`. The web follows a category by posting one follow per missing kind.
- Genres are Apple's chart page and the Play scraper's enum (tables in `@asobeast/shared`) or `overall`; the device is in the key, one value per store today.

Reading and the page:

- Movement and trending are pure functions of two captures (`charts/chart-movement.ts`): the newest capture at or before the day minus the window, no older than one more window. Reading never calls a store.
- The page shows a category's three kinds side by side, the top `CHART_COLUMN_ROWS` (25) of each, and one kind's table behind `?view=table` (`chartHref` links a category, `tableHref` a kind).
- A capture with no entries is a page with `capture` set and `entries: []`: the web reads it with `listsNoApps` as **No apps in this chart**, offers no **Capture today** for that day and never treats it as uncaptured. An `answeredNoApps` answer is toasted, neither seeded nor stored.
