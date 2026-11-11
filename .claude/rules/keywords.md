---
paths:
  - "apps/api/src/keywords/**"
  - "apps/api/src/competitors/**"
  - "apps/api/src/metadata/**"
  - "apps/api/src/store-connect/*keyword-field*"
  - "apps/web/src/app/**/{keywords,competitors,metadata}/**"
  - "apps/web/src/components/{keywords,competitors,metadata,localizations}/**"
  - "apps/web/src/lib/csv-import/**"
  - "apps/web/src/lib/keyword-*.ts"
---

# Keyword rules

## Domain rule 2: The iOS keyword field (100 chars) is private, and there is one per App Store localization, edited in one place

Counting:

- The field never appears on the store page and cannot be scraped; the owner types it on the metadata page (source `KEYWORD_FIELD`).
- Store fields are counted in Unicode code points, the way App Store Connect counts: `keywordFieldChars` against `KEYWORD_FIELD_CHAR_LIMIT`, and `countChars` and `truncateChars` (`packages/shared/src/aso/limits.ts`) for the title, the subtitle and the 100 character cap on one tracked phrase (`TRACKED_KEYWORD_CHAR_LIMIT`, used by `checkKeywordText` and the listing combinations; the `track_keywords` tool relies on zod, which counts code points too). Never `String.length`, `String.slice` or grapheme clusters (`Intl.Segmenter` differs across Node, Chromium and WebKit). `countMaxLengthChars` is only what `class-validator`'s `MaxLength` counts, not a store limit.

Storage:

- `KeywordField` (RLS, `@@id([appId, localization])`, explicit tags, never `NULL`) stores the normalized phrases in submission order and is the only source of truth. A tracked keyword is in a field when a saved field of a localization its market reads (`keywordFieldLocalizations`) holds its normalized text, as `indexKeywordFields` (`keywords/keyword-field-index.ts`) answers and `reportedSource` reports. Never store membership on `TrackedKeyword`.
- What an app ships is `AppLocalization` (RLS, `@@id([appId, localization])`, `origin` `manual` or `detected`, validated in code): the home localization (`homeLocalization`, never stored or removable), its rows and any localization with a saved field, joined only in `AppLocalizationsService.list`.
- I-FIELD: a non empty save of a localization other than home upserts its row as `manual` in the save transaction (`recordAppLocalizations`), never downgrading `detected`; an emptied field keeps its row; only `DELETE /apps/{id}/localizations/{localization}` removes one.

Writing:

- Every save goes through `KeywordFieldWriter`, one transaction (`QuotaService.admitKeywordMarkets` takes the quota lock, then the per app field lock) that stores the phrases, records the localization, tracks every phrase in every market of `trackIn`, and stops tracking a dropped phrase as `KEYWORD_FIELD` in every market reading the localization unless another field read there holds it. `remove` is the same transaction with an empty field and the row deleted.
- `trackIn` is a possibly empty subset of the app's markets (`appMarkets`: home first, then every country with a tracked keyword, active or paused) whose storefront reads the localization (`trackInError`). Untracking a keyword never edits a field.
- The pure rules live in `keywords/localization-markets.ts` (`readsKeywordField`, `readerRole`, `readersOf`), `keyword-field-save-plan.ts` and `market-keyword-fields.ts`; a preview computes them and writes nothing.
- The editor exists on the metadata page only. The keywords page reports through `GET /apps/{id}/keyword-fields/market` and never writes; its words read twice and split phrases are diagnostics that never reach coverage, the audit or an Action Center rule.
- `GET` and `PUT /apps/{id}/keyword-field` without a query mean the home storefront's default localization; `PUT` calls the writer with `trackIn = [country]`.

Import from App Store Connect (per app, owner only, opt in):

- `POST` and `DELETE /apps/{id}/keyword-fields/import` are `@SessionOnly()` with `OwnerGuard`. `KeywordFieldImportController` hands to `KeywordFieldImportService` (store-connect): start upserts the `KeywordFieldSync` row through `AppLocalizationsService.startImport`, enqueues the sync on the store reports queue and removes the row if the enqueue fails; stop runs `stopImport`. Start answers 409 unless the state is `available`, stop 404 when nothing follows. A stop wins over a run in flight: the sync only updates the existing row (`updateMany`) and checks it before every field write.
- The localizations result carries `storeImport` (`STORE_IMPORT_STATES`: `unavailable` without a console key, `available`, `following`, `paused` while the key is refused) from `importStateOf`, which reads the connection row itself (a module dependency would cycle). `storeManaged` is true only while the row exists and the key works, so a rejected key or a removed `STORE_CONNECT_ENCRYPTION_KEY` hands the fields back; `refuseManagedField` refuses a save while `following`. The sync's `at` is null until the first read; a skipped read records `lastError`.
- `AscKeywordFieldSync` (`keywords/keyword-field-managed.ts`) runs after every report download for apps holding a row: it writes each served localization through the writer with `trackIn` limited to markets reading it as their default, removes a stored localization the store stopped serving (never home), skips an unchanged import, and records a store 429 as `rateLimited` on the report summary instead of failing. `ListingCaptureService.releaseChangedFields` enqueues it only when the row exists and the listing version changed.

## Domain rule 15: A keyword import is validated by the server and only adds or resumes keywords

- The browser reads the file (`apps/web/src/lib/csv-import/`: decode, tokenize, header aliases, column mapping, the country cell, the scope) and sends `KeywordImportRow[]`; it applies no keyword rule and decides no status. It narrows a file to the app and store being imported when the file names them (`scope.ts`: `App Id`, `App Name`, `Platform` or `Store` column) and says how many rows it left out.
- `POST /apps/{id}/keywords/import/preview` and `POST /apps/{id}/keywords/import` run one pure plan (`classifyImportRows`, then `planImport`) with a status per row: `new`, `resume`, `tracked`, `duplicate`, `invalid`, `overQuota`. A row meets the limits of `PATCH /apps/{id}/keywords/{keywordId}`, measured the same way (a note with `countMaxLengthChars`).
- The preview is `@RateLimitClass('read')` and `@ReadOnlyEndpoint()` and writes nothing. The import tracks `new` and `resume` rows as `MANUAL` with their tags and note in one `QuotaService.admitKeywordMarkets` transaction, never changes an already tracked keyword's tags or note, changes a paused one only by resuming it, skips rows over the keyword room, and keeps the admission as the race safety net (403, nothing written). It answers the plan in `summary` and `results`, what it wrote in `imported`, and `quota.used` read after the write.
- A request carries at most `KEYWORD_IMPORT_LIMIT` (500) rows, inside the 100 KB body limit. The web splits a longer file into parts of at most that many rows and 96,000 bytes (`importParts`, `lib/keyword-import.ts`) and previews the next part only after importing the previous one; it refuses only a single row too large for a request. Changing the columns, app or market restarts from the first part; a part with nothing to import offers **Skip to part N**.
- The added daily store requests come from `requestsPerJob` and travel in `cost`, never copied into the web. A phrase another app of the workspace tracks opens no keyword market (`countKeywordMarkets` counts distinct rows). The CSV export ends with `country`, and the importer undoes the apostrophe `escapeField` puts before a formula-like cell.

## Domain rule 22: The keyword breakdown judges with coverage's own functions and never guesses a listing

- `GET /apps/{id}/keywords/{keywordId}/breakdown` (`KeywordBreakdownService`) reads stored rows only. It builds surfaces with `judgingSurfaces` (the primary app with its non empty saved fields, a competitor with none), judges with `coversKeyword` so it never disagrees with the coverage table, and reports an accent folded word (`searchKey`) as `folded` without counting it.
- Each localization is judged alone, because App Store search never combines words of two localizations. A searched localization not captured for an app is listed in `unread`, never borrowed. `ranking: null` is never checked; `position: null` is checked and not found.
- Competitor notes are pure rules in `keyword-breakdown-insights.ts` with named thresholds (`RATINGS_GAP_FACTOR`, `RATINGS_MIN_GAP`, `SETTLING_DAYS`); the ratings rule compares only ratings that both come from the keyword's market listing.
- The web renders the server's `segments`, decides no match itself, and reads with `useQuery` under `appKeys.compareRoot`. The MCP tool `keyword_breakdown` wraps the route.
- `GET /apps/{id}/keywords` also answers `dropStreak` (`keyword-drop-streak.ts`: consecutive worsening checks within the last 60, null when paused or stale) and, for active keywords, `uncovered` (`judgeKeywordCoverage`, `metadata/keyword-coverage-judge.ts`, shared with the coverage table); the insight badges read nothing else.
- It also answers `recentPositions` (`recentPositions`, `keywords.mapper.ts`: the checks of the `KEYWORD_RECENT_POSITION_DAYS` UTC days ending at the latest check, oldest first, read from the rankings the list already loads) and, with `topApps`, the first `KEYWORD_TOP_APPS` apps of the newest stored `SerpEntry` day (`keyword-top-apps.ts`), each with a role (`own`, `competitor`, `other`), or null when that day is older than yesterday UTC, the same freshness as `competitorsInTop10`. Both are stored rows only and optional in the contract.
- With `listingMarks` it answers optional `matchedIn`: the keyword text in runs, each word marked with the strongest surface of its market that holds it (`keywordMarker`, `keywords/keyword-marks.ts`, over `keywordSurfaces`, judged by `wordMatch` and located by `markWords`, exact before folded). Never by `runsTogether` (scoring evidence) and never in the description; when coverage says a surface covers the keyword, every word is marked.
- Competitor gap lists answer on `GET /apps/{id}/competitors/analysis` beside the three unchanged older arrays: pure rules in `competitor-gap-lists.ts` and `competitor-threats.ts` over `KeywordsService.compare` and nine days of `KeywordRanking` rows of the app and its comparable competitors (not delisted, not unchecked), with thresholds `GAP_TOP`, `GAP_YOU_BELOW`, `WINNABLE_COMPETITOR_FROM`, `THREAT_WITHIN` and `THREAT_WINDOW_DAYS` from `@asobeast/shared`. A threat reads rankings through `overtaken` (`rank-milestones.ts`), never an alert event (events exist only for subscribers), and a stale check never makes one.

## Domain rule 25: A keyword's class is derived at read time by one matcher and only the owner can override it

- `KeywordClass` (`ownBrand`, `competitorBrand`, `generic`) is answered only on `GET /apps/{id}/keywords` and the `PATCH` answer (`listTracked` with `brandFacts`; `listingFacts` builds `classOf` via `loadBrandProfile` and `keywordClassifier`, `keywords/keyword-brand-profile.ts`).
- `classifyKeyword` (`keywords/keyword-class.ts`) decides from stored data: a brand when the keyword contains the whole brand name of the app (leading words of its home title and of its title in the keyword's market, `brandNameOf` in `keywords/brand-words.ts`, plus its developer name without legal suffixes) or of one competitor, or when the SERP `brand` flag was raised with no name to match. When most top 10 titles target the phrase (`GENERIC_SERP_RELEVANCE`) it is generic unless flagged. A competitor name your own market listing uses, or that `CATEGORY_NAME_COMPETITORS` competitors share (plurals equal), is a category word, never a brand, and makes the keyword generic even when flagged.
- Everything that splits by brand (insight badges, share of voice, compare two dates, the branded acquisitions split, the country scan) calls this matcher, never a copy.
- The owner's override is `TrackedKeyword.keywordClass`, validated with `isKeywordClass` (an unknown value reads as none), set by `PATCH /apps/{id}/keywords/{keywordId}` (`null` clears) and answered as `keywordClassSource: 'owner'`; it is not an MCP write tool. The non branded share of voice reads classes alone through `KeywordsService.keywordClasses` (`keywords/keyword-classes.ts`), the same `classFacts` without the rankings, SERP days and acquisitions.
