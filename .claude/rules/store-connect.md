---
paths:
  - "apps/api/src/store-connect/**"
  - "apps/web/src/app/**/integrations/**"
  - "apps/web/src/components/integrations/**"
  - "apps/web/src/lib/funnel.ts"
  - "apps/web/src/lib/store-connection-copy.ts"
  - "apps/api/src/changes/change-impact*.ts"
  - "apps/api/src/actions/rules/{conversion-investigate-drop,listing-cpp-underperforms}.ts"
---

# Store console rules

## Domain rule 23: A console key is sealed, owner only, and the funnel is read from the store's own report

Connections and sealing:

- Off until `STORE_CONNECT_ENCRYPTION_KEY` is set: `SECRET_BOX` is `null`, `GET /store-connections` answers `available: false`, every change but a disconnect answers 409, the schedule is removed and nothing reaches Apple or Google. A stored key that no longer decrypts answers 409 `CREDENTIAL_UNREADABLE` and marks the connection rejected.
- One connection per workspace and store: `GET /store-connections`, and `PUT`, `POST …/verify`, `POST …/sync`, `DELETE /store-connections/{store}`. Every change is `@SessionOnly()` with `OwnerGuard`, so no `asob_` token can replace or remove a key; members read the state.
- `SecretBox` (AES-256-GCM, `v1.<key id>.<iv>.<tag>.<body>`) seals the credential as one JSON string with the context `store-connection:<workspaceId>:<store>`, so a ciphertext copied to another workspace never opens. `STORE_CONNECT_ENCRYPTION_KEY_PREVIOUS` opens an older one and `StoreConnectionService.openAppStore` and `openPlay` reseal it. Issuer ID, key ID and public key fingerprint stay in clear; the sealed value is never answered, exported (`SECRET_FIELDS`) or logged (PEM blocks and signed tokens are scrubbed).

App Store Connect:

- `PUT` verifies the key with Apple before storing (422 refused, 502 unreachable, 400 for a key that is not a P-256 PKCS8 PEM; `normalizePrivateKey` rebuilds one whose lines a password field joined), replaces any earlier key and its report requests, and queues a sync.
- Report access is learned, never asked: a 201 creating a report request records `admin`, a 403 records `readOnly` with the one sentence that an Admin key is needed; an existing request is adopted by listing first.
- The sync runs in its own `store-connect` queue at concurrency 1, outside the store budget and the proxy pool, one deduplicated job per workspace and store, fanned out by `CRON_STORE_REPORTS` to the workspaces `ActiveWorkspaces.forDailyRun` names and queued by connect, verify and sync.
- Per run it matches primary App Store apps to the key's apps by store id (`unmatched` otherwise), lists each app's remote requests so a stopped or dropped ongoing request is placed again, requests the one time snapshot and the ongoing Discovery and Engagement report, downloads at most `MAX_INSTANCES_PER_RUN` (200) daily instances newer than `lastProcessingDate` in ascending order, keeps the gzip in `StoreReportInstance.raw` for `RETENTION_STORE_REPORTS_DAYS`, and pivots rows by header name into `StoreFunnelDay` (app, date, territory, source type, page type) with an upsert an older processing date never overwrites; `lastProcessingDate` only advances.
- Failures: an Apple error for one app, or an unreadable report, stops only that app or request for the run. A non final attempt then keeps the earlier `lastError` and fails with `PartialSyncRetryError` so BullMQ retries; only the last leaves `PARTIAL_SYNC` or `PLAY_PARTIAL_SYNC` (`retriesFailures`, never after a rate limit). A key that may not request reports records `ADMIN_KEY_NEEDED`. A segment of the wrong size stops that request; a checksum mismatch is only logged; a 429 ends the run normally; a 5xx is retried once. A 401 or 403 from the API after the request phase marks the connection `rejected` with `refusalOf` (the missing agreement code `FORBIDDEN.REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED` names the agreement, anything else the key) and fails the job as unrecoverable; a refused segment download is a plain error and never rejects the key.
- When the key may read it, the sync also downloads the detailed report into `StoreFunnelPageDay` (date, territory, page title; `no page` dropped) with its own `detailedReportId` and `detailedLastProcessingDate`. Any error there but a rate limit skips only that lane for the run.

The funnel:

- A territory resolves to a storefront through `countryOfTerritory` or keeps a `null` country, which market filters leave out and "all markets" counts.
- `GET /apps/{id}/funnel` answers `connected: false` with empty series for a competitor, an app without an ongoing `requested` request of an active connection, or with the feature off, even when rows survive a disconnect. Otherwise a zero filled daily series and the 7, 14 and 28 day windows of complete days against the period before, plus optional `pages` (28 complete days, default page first).
- A day is complete once three days old and no later than the app's newest stored day (`reportedThrough`), derived at read time, so a lagging sync never turns missing days into zeros. App Store conversion is Get taps over unique impressions as Apple reports them; a dimension a store does not report is `null`, never estimated.
- `GET /apps/{id}/changes/impact` adds an optional `funnel` block per window only while the connection reports the app (`measureChangeFunnel`): the same number of complete days before and from the change, `measured` when every day after is final, `pending` while Apple finishes them, `unmeasured` when nothing was reported before. Without a connection the field is absent.
- The conversion rules read home market days ending at `completeThrough` and hold an existing action `withheld` instead of resolving or confirming it, each on its own conditions. `conversion.investigate_drop` (21 days) holds while the console stops reporting the app (`ActionFunnel.reporting`), a day of the window is missing, the baseline has no page views or gets, or page views move past `CONVERSION_PAGE_VIEW_TOLERANCE`. `listing.cpp_underperforms` (14 days) holds while the console stops reporting, the default page or the page itself has under `CPP_MIN_PAGE_VIEWS` (100) page views, or the default page's conversion is zero.

Google Play with a service account:

- `PUT /store-connections/GOOGLE_PLAY` takes `serviceAccountJson` and a `pubsite_prod` `bucket` (`StoreConnectionBodyPipe`; a body `store` differing from the path is 400). The JSON must hold an RSA PEM key (400 otherwise). Verification lists `stats/store_performance/` once with a `devstorage.read_only` token (401, 403 and 404 answer 422, the last naming the bucket). The sealed credential is `{ clientEmail, privateKeyId, privateKey, bucket }`, `issuerId` is the email, `keyId` the private key id, and `reportAccess` is `admin` at once.

Google Play with a Google sign in:

- Available when `GOOGLE_PLAY_OAUTH_CLIENT_ID`, `GOOGLE_PLAY_OAUTH_CLIENT_SECRET` and `WEB_PUBLIC_URL` are set; otherwise `GOOGLE_OAUTH_CLIENT` is `null`, `GET /store-connections` answers `googleSignIn: false`, both sign in routes answer 409, and a stored Google account connection is never rejected for it (verify answers 409, the sync fails and retries).
- `GOOGLE_PLAY_OAUTH_PUBLISHED=false` (default `true`) marks a consent screen still in testing, whose sign ins Google expires after seven days: the client stays (`GoogleOAuthClient.published` is `false`) so connected sign ins keep refreshing and verifying, `GET /store-connections` answers `googleSignIn: false` and the start route answers 409 `SIGN_IN_UNPUBLISHED`; a completion already started still finishes.
- `POST /store-connections/GOOGLE_PLAY/sign-in` with the `bucket` answers the consent address (offline access, `prompt=consent`, PKCE S256, scopes `openid email devstorage.read_only`) with a state `SecretBox` seals with the context `play-sign-in:<workspaceId>:<userId>` around the bucket, the PKCE verifier and a ten minute expiry (`sign-in-state.ts`). Google returns to `PLAY_SIGN_IN_PATH` (`/integrations/google-play`), which posts code and state once to `POST …/sign-in/complete`.
- Completion opens the state only for the same owner and workspace (400 otherwise), redeems the code (400 when Google refuses), answers 422 when the granted scopes leave out storage, lists the bucket with the refresh token as a key is checked, and seals `{ email, refreshToken, bucket }` with `credential = 'googleAccount'`, `issuerId` the email and `keyId` the Google subject. Both routes are `@SessionOnly()` with `OwnerGuard`.
- `GcsApi` takes a `GoogleGrant` (JWT bearer assertion or refresh token grant, built by `GcsApiFactory`). `playRefusal` (`play/play-refusal.ts`) is the one wording of a Play refusal: a token answer is a refusal only for `invalid_grant`, `invalid_client`, `unauthorized_client` and `redirect_uri_mismatch` (other 4xx stay a retryable `GcsError`, 429 a rate limit); the last three name the instance's OAuth client (`CLIENT_REFUSED`, also 409 on completion); a 403 names the account and the Account permissions tab; only a 404 names the bucket.

Play report sync:

- `PlayReportSync` lists each primary Play app's files under its package prefix (at most `MAX_LISTED_OBJECTS`, `unmatched` when none), checks the bucket once per run (a refusal or missing bucket rejects the connection), marks an app `forbidden` when Google refuses its listing or a file, skips a vanished or unreadable file (`PLAY_PARTIAL_SYNC`) without holding back the rest, skips a file listed above `PLAY_REPORT_MAX_BYTES` (counted as `skipped`, recording `PLAY_PARTIAL_SYNC` at once) and stops reading one past it, keeps search terms storable (`MAX_TERM_CHARS`, no NUL, no lone surrogate) and counts within int4.
- It downloads the current and previous month's country and traffic source files only when the object's `generation` changed, recorded as a `MONTHLY` `StoreReportInstance` whose `remoteId` is the object name and generation; a newer generation replaces that month's rows of its breakdown in one transaction.
- The country file writes `StoreFunnelDay` rows with `sourceType = 'all'` and the country as territory, the traffic file rows with `territory = 'all'` and `country = null` (`funnelScope`), so a market reads the first set, "all markets" the second, and they are never summed. Visitors land in `pageViews`, acquisitions in `gets`; Play conversion is acquisitions over visitors and `impressions` stay `null`.
- The traffic file also replaces the month's `StoreFunnelSearchTerm` rows (RLS, unique on app, month and raw term). `GET /apps/{id}/keywords` gives a Play keyword of a reporting connection the optional `playAcquisitions` of the newest complete month (or the only month in progress), summing spellings whose `normalized` term equals `normalizeText` of the keyword; App Store keywords carry no field.
