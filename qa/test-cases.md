# asobeast regression test cases

Commit `08225c3`, branch `claude/asobeast-regression-testing-f0udcj`.
Results for every case are in `report-2026-09-04.md`. Evidence is under `qa/evidence/`.

Conventions: "owner" is `qa-owner@asobeast.test` (workspace `ws_default`), "tenant B" is
`qa-other@asobeast.test` (workspace `ws_other`). The seeded dataset is created by
`qa/seed-qa.ts` and contains 5 apps, 216 keywords, 167 rankings, 5 reviews.

---

## AUTH — registration, login, session

### TC-AUTH-001 Auth status on a brand new installation
Priority: P1 major
Preconditions: empty database, no user exists
Steps:
1. `GET /auth/status`
Expected: 200, `registrationOpen: true`, `setupRequired: true`, `authenticated: false`.

### TC-AUTH-002 Register rejects a malformed email
Priority: P1 major
Preconditions: no owner exists
Steps:
1. `POST /auth/register` with `{"email":"notanemail","password":"password123"}`
Expected: 400 naming the email field. No user is created.

### TC-AUTH-003 Register rejects a password below the 10 character minimum
Priority: P1 major
Preconditions: no owner exists
Steps:
1. `POST /auth/register` with a 9 character password `123456789`
Expected: 400 "password must be longer than or equal to 10 characters".

### TC-AUTH-004 Register rejects an empty body
Priority: P2 minor
Steps:
1. `POST /auth/register` with `{}`
Expected: 400 listing every missing required field. No 500.

### TC-AUTH-005 Register with a whitespace-only password
Priority: P2 minor
Preconditions: no owner exists
Steps:
1. `POST /auth/register` with `{"email":"a@b.com","password":"          "}` (ten spaces)
Expected: the password is trimmed and rejected as empty, or rejected as too weak. A
password made only of whitespace should not be accepted.

### TC-AUTH-006 Register rejects a name over 120 characters
Priority: P2 minor
Steps:
1. `POST /auth/register` with a 121 character `name`
Expected: 400 naming the length limit.

### TC-AUTH-007 Registration closes once the owner exists
Priority: P0 blocker
Preconditions: owner account created
Steps:
1. `GET /auth/status`
2. `POST /auth/register` with a second, different email
Expected: status reports `registrationOpen: false`; the second registration is refused
with 403 "Registration is closed". A self-hosted instance must not accept a second signup.

### TC-AUTH-008 Login with the correct password
Priority: P0 blocker
Steps:
1. `POST /auth/login` with the owner email and password
Expected: 200, an `AuthUser` body, a session cookie set.

### TC-AUTH-009 Login with a wrong password
Priority: P0 blocker
Steps:
1. `POST /auth/login` with the owner email and `wrongwrongwrong`
Expected: 401 "Invalid email or password".

### TC-AUTH-010 Login does not leak whether an account exists
Priority: P1 major
Steps:
1. `POST /auth/login` for `nobody@nowhere.com` with any password
2. Compare status code, message and timing with TC-AUTH-009
Expected: identical 401 and identical message; no user enumeration.

### TC-AUTH-011 Email matching is case insensitive
Priority: P2 minor
Steps:
1. `POST /auth/login` with `A@B.COM` for an account stored as `a@b.com`
Expected: 200; the user logs in.

### TC-AUTH-012 `/auth/me` refuses an anonymous caller
Priority: P0 blocker
Steps:
1. `GET /auth/me` with no cookie
Expected: 401 "Not authenticated"; no user data.

### TC-AUTH-013 `/auth/me` refuses a forged session cookie
Priority: P0 blocker
Steps:
1. `GET /auth/me` with `Cookie: asobeast_session=garbage.token.here`
Expected: 401; no user data, no 500.

---

## APP — importing and reading a tracked app

### TC-APP-001 Empty state with zero apps
Priority: P1 major
Preconditions: fresh workspace, no apps
Steps:
1. `GET /apps`
Expected: 200 and `[]`, not an error.

### TC-APP-002 Import rejects an empty URL
Priority: P1 major
Steps: 1. `POST /apps` with `{"url":""}`
Expected: 400 "url should not be empty".

### TC-APP-003 Import rejects free text
Priority: P1 major
Steps: 1. `POST /apps` with `{"url":"not a url at all"}`
Expected: 400 "Unrecognized store URL or id".

### TC-APP-004 Import rejects a non-store URL
Priority: P1 major
Steps: 1. `POST /apps` with `https://example.com/foo`
Expected: 400 "Unrecognized store URL or id".

### TC-APP-005 Import rejects a malformed country code
Priority: P2 minor
Steps: 1. `POST /apps` with a valid Apple URL and `"country":"XXXXX"`
Expected: 400 naming the `^[a-z]{2}$` pattern.

### TC-APP-006 Import refuses an internal address (SSRF)
Priority: P0 blocker
Steps: 1. `POST /apps` with `http://127.0.0.1:4000/health`
Expected: 400. The server must not fetch a loopback address on the caller's behalf.

### TC-APP-007 Import refuses a `file://` URL
Priority: P0 blocker
Steps: 1. `POST /apps` with `file:///etc/passwd`
Expected: 400. No local file is read.

### TC-APP-008 Unknown app id returns 404
Priority: P1 major
Steps: 1. `GET /apps/does-not-exist`
Expected: 404 "App does-not-exist not found".

### TC-APP-009 SQL injection payload in a path parameter
Priority: P0 blocker
Steps: 1. `GET /apps/%27%3B%20DROP%20TABLE%20apps%3B--`
Expected: 404, the payload echoed as inert text, the `Keyword`/`App` tables still present.

### TC-APP-010 Import when the store endpoint is unreachable
Priority: P1 major
Preconditions: outbound access to `itunes.apple.com` blocked
Steps: 1. `POST /apps` with a well-formed Apple App Store URL
Expected: a 5xx with a message naming the store and the failure, returned promptly. The
request must not hang and must not leave a half-created app row.

### TC-APP-011 Import when Google Play is unreachable
Priority: P1 major
Steps: 1. `POST /apps` with a well-formed Google Play URL
Expected: as TC-APP-010, naming `GOOGLE_PLAY`.

---

## READ — every read surface with realistic data

### TC-READ-001..020 Read every app-scoped and workspace-scoped GET
Priority: P1 major
Preconditions: seeded dataset loaded, logged in as owner
Steps:
1. `GET` each of: `/apps`, `/apps/:id`, `/apps/:id/summary`, `/apps/:id/keywords`,
   `/apps/:id/rankings`, `/apps/:id/reviews`, `/apps/:id/reviews/histogram`,
   `/apps/:id/changes`, `/apps/:id/competitors`, `/apps/:id/competitors/analysis`,
   `/apps/:id/audit`, `/apps/:id/metadata/audit`, `/apps/:id/category-ranks`,
   `/apps/:id/visibility-history`, `/apps/:id/ratings-history`, `/actions`, `/portfolio`,
   `/keywords/:keywordId/serp`, `/jobs/budget`, `/changes/recent`
Expected: every route returns 200 with a well-formed body and no 5xx, including for the
unicode app and for keywords that have no metrics.

---

## AUTHZ — tenant isolation

### TC-AUTHZ-001..017 Tenant B may not read or mutate tenant A's resources
Priority: P0 blocker
Preconditions: two workspaces, each with its own app; logged in as tenant B
Steps:
1. As tenant B request each of tenant A's app-scoped routes by id: detail, keywords,
   rankings, reviews, changes, competitors, audit, metadata audit, summary, category
   ranks, visibility history, ratings history, actions, keyword-countries, keyword-field
2. As tenant B request `GET /keywords/<tenant A keyword id>/serp`
3. As tenant B send `DELETE /apps/<tenant A app id>`
Expected: every request is refused (404 preferred, so ids cannot be probed). No field of
tenant A's data appears in any response. Tenant A's app still exists afterwards.

### TC-AUTHZ-018 Action items are workspace scoped
Priority: P0 blocker
Preconditions: tenant A has an open ActionItem carrying a recognisable string
Steps:
1. As tenant A, `GET /apps/<A app>/actions` and confirm the action is listed
2. As tenant B, `GET /apps/<A app>/actions`
3. As tenant B, `GET /actions`
Expected: tenant B sees no items and none of tenant A's content.

### TC-AUTHZ-019 Account export is workspace scoped
Priority: P0 blocker
Steps:
1. As tenant B, `GET /account/export`
Expected: 200 containing only tenant B's rows; none of tenant A's app names appear.

### TC-AUTHZ-020 Account export carries no credentials
Priority: P0 blocker
Steps: 1. As owner, `GET /account/export`; search the payload for `passwordHash`
Expected: no password hash, no `AUTH_SECRET`, no database password.

### TC-AUTHZ-021 Export refuses an anonymous caller
Priority: P0 blocker
Steps: 1. `GET /account/export` with no cookie
Expected: 401.

---

## KW — keyword tracking

### TC-KW-001 Empty keyword array
Priority: P2 minor
Steps: 1. `POST /apps/:id/keywords` with `{"keywords":[]}`
Expected: 400 "keywords should not be empty".

### TC-KW-002..004 Empty, whitespace-only and control-character keywords
Priority: P2 minor
Steps: 1. Post `[""]`, then `["     "]`, then `["\t\n"]`
Expected: 400 "Keyword must not be empty" each time; no blank Keyword row is created.

### TC-KW-005..007 Wrong types
Priority: P2 minor
Steps: 1. Post `[123]`, then `"hello"` as `keywords`, then `[null]`
Expected: 400 naming the type expectation; no 500.

### TC-KW-008 Bulk add above the 200 item cap
Priority: P1 major
Steps: 1. Post 201 keywords in one request
Expected: 400 "keywords must contain no more than 200 elements".

### TC-KW-009 Invalid country on add
Priority: P2 minor
Steps: 1. Post a valid keyword with `"country":"USA"`
Expected: 400 naming the `^[a-z]{2}$` pattern.

### TC-KW-010 Paste of 10 000 characters
Priority: P2 minor
Steps: 1. Post a single keyword of 10 000 `z` characters
Expected: 400 "Keyword exceeds 100 characters"; no truncation, no 500.

### TC-KW-011 Add a keyword (happy path)
Priority: P0 blocker
Steps: 1. Post `["travel trivia game"]`; 2. query the database
Expected: 201; exactly one `Keyword` row and one `TrackedKeyword` row.

### TC-KW-012 Adding the same keyword twice
Priority: P1 major
Steps: 1. Post `["travel trivia game"]` again; 2. count rows
Expected: 201 and still exactly one row. No duplicate.

### TC-KW-013 Case and whitespace normalisation
Priority: P1 major
Steps: 1. Post `["  TRAVEL   Trivia Game  "]`; 2. list rows matching travel/trivia
Expected: still one row, stored as `travel trivia game`.

### TC-KW-014 Double-click / concurrent submit
Priority: P0 blocker
Steps: 1. Fire 8 identical `POST .../keywords` requests concurrently for one new phrase
2. Count `Keyword` and `TrackedKeyword` rows
Expected: exactly one of each. No duplicate record from a fast double click.

### TC-KW-015 Unicode keywords
Priority: P1 major
Steps: 1. Add, one per request: Polish diacritics `zażółć gęślą`, Japanese
`日本語 キーワード`, emoji `🎮 game`, Arabic RTL `لعبة الجغرافيا`
Expected: 201 for each; each stored byte-for-byte and rendered correctly in the UI.

### TC-KW-016 Keyword length boundary
Priority: P1 major
Steps: 1. Add a keyword of exactly 100 characters; 2. add one of exactly 101
Expected: 100 is accepted, 101 is refused with "Keyword exceeds 100 characters".

### TC-KW-017 HTML/script payload as a keyword
Priority: P1 major
Steps: 1. Add `<img src=x onerror=alert(1)>`
Expected: refused or stored inert. If stored, it renders as literal text and executes
nothing.

### TC-KW-018 Stored XSS payloads render escaped
Priority: P0 blocker
Preconditions: `<script>alert(1)</script>` seeded directly into keyword, review, competitor
name and change-event rows, bypassing API validation
Steps: 1. Open `/apps/:id/keywords`, `/reviews`, `/competitors`, `/changes` in a browser
with a dialog handler attached
Expected: no dialog fires, no injected inline `<script>` node, the payload is visible as
literal text.

---

## Q — query parameters and date ranges

### TC-Q-001 Inverted date range
Priority: P2 minor
Steps: 1. `GET /apps/:id/rankings?from=2026-09-04&to=2026-01-01`
Expected: 200 with zero points, not an error and not the unfiltered set.

### TC-Q-002 Invalid date format
Priority: P2 minor
Steps: 1. `GET /apps/:id/rankings?from=not-a-date`
Expected: 400 "from must be a valid ISO 8601 date string".

### TC-Q-003..007 Unknown numeric parameter with boundary values
Priority: P2 minor
Steps: 1. `GET /apps/:id/rankings?days=` each of `0`, `-5`, `999999`, `1e9`, `3.7`
Expected: 400 "property days should not exist" (whitelist validation), never a 500 and
never a silently ignored parameter.

### TC-Q-008 Invalid sort value
Priority: P2 minor
Steps: 1. `GET /apps/:id/keywords?sort=DROP TABLE`
Expected: 400 listing the allowed sort values.

### TC-Q-009 Valid sort value
Priority: P2 minor
Steps: 1. `GET /apps/:id/keywords?sort=position`
Expected: 200, ordered results.

### TC-Q-010..012 Review filter bounds
Priority: P2 minor
Steps: 1. `?score=99`; 2. `?limit=-1`; 3. `?limit=1000000`
Expected: 400 naming the bound (score max 5, limit 1..200).

### TC-Q-013 Normal date filtering is applied
Priority: P1 major
Steps: 1. Request rankings with no range, then `from`, then `to`, then both
Expected: point counts and min/max dates shrink consistently with the requested window.

---

## TOK / WH — tokens, webhooks

### TC-TOK-001..007 API token lifecycle and validation
Priority: P1 major
Steps: 1. list (empty); 2. create with no name; 3. create with empty name; 4. create
`qa token`; 5. create with an XSS name; 6. create with a 10 000 character name;
7. delete an unknown token id
Expected: 200 `[]`; 400; 400; 201 returning the plaintext token exactly once; the XSS name
is stored inert and rendered escaped; 400 at 121+ characters; deleting an unknown id does
not 500.

### TC-WH-001 Webhook refuses a loopback target
Priority: P0 blocker
Steps: 1. `POST /webhooks` with `http://127.0.0.1:4000/health` and a valid event
Expected: 400 naming the private/reserved address rule.

### TC-WH-002 Webhook refuses cloud metadata
Priority: P0 blocker
Steps: 1. `POST /webhooks` with `http://169.254.169.254/latest/meta-data/`
Expected: 400. The instance metadata endpoint must never be reachable via a webhook.

### TC-WH-003..004 Webhook refuses RFC1918 targets
Priority: P0 blocker
Steps: 1. `http://10.0.0.5/hook`; 2. `https://192.168.1.10/hook`
Expected: 400 for both.

### TC-WH-005 Webhook refuses a non-http scheme
Priority: P1 major
Steps: 1. `file:///etc/passwd`
Expected: 400 "url must be a URL address".

### TC-WH-006 Webhook rejects an unknown event name
Priority: P2 minor
Steps: 1. Create with `"events":["not.a.real.event"]`
Expected: 400 listing the seven valid event names.

### TC-WH-007 Webhook accepts a valid public https target
Priority: P1 major
Steps: 1. Create with `https://example.com/hook` and two valid events
Expected: 201; the row appears in `GET /webhooks`.

---

## PERSIST — durability

### TC-PERSIST-001 State survives a full stack restart
Priority: P0 blocker
Steps:
1. Record row counts for apps, keywords, tracked keywords, rankings, reviews, webhooks and
   tokens, and capture `GET /apps/:id`
2. Restart PostgreSQL, Redis and the API process
3. Repeat the counts and the app detail request
Expected: identical counts and a byte-identical app detail payload.

### TC-PERSIST-002 Session survives a restart
Priority: P1 major
Steps: 1. After the restart in TC-PERSIST-001, call `/auth/me` with the same cookie
Expected: 200; the user stays signed in.

### TC-PERSIST-003 API reconnects to a restarted database and cache
Priority: P1 major
Steps: 1. Restart PostgreSQL and Redis while the API keeps running; 2. `GET /health`
Expected: `db: up`, `redis: up` without restarting the API.

---

## UI — browser behaviour

### TC-UI-001 Protected routes redirect when logged out
Priority: P0 blocker
Steps: 1. With no session, open `/`, `/settings`, `/apps/:id`
Expected: each lands on `/login` (with a `next` parameter where applicable) and the
protected content never appears, not even for one frame.

### TC-UI-002 Session expiry mid-session
Priority: P0 blocker
Steps: 1. Log in and open the keywords page; 2. delete the session cookie; 3. navigate
Expected: redirect to `/login?next=...`; no app data rendered.

### TC-UI-003 Every route loads without a page error
Priority: P1 major
Steps: 1. Logged in, visit all 16 app routes at 1440x900 with the console observed
Expected: HTTP 200, no uncaught exception, no React error.

### TC-UI-004 No horizontal overflow at 375 px
Priority: P2 minor
Steps: 1. Visit all 16 routes at 375x812; compare `scrollWidth` with `clientWidth`
Expected: equal on every route; menus still open.

### TC-UI-005 Dark mode renders
Priority: P2 minor
Steps: 1. Load dashboard, keywords and overview with `prefers-color-scheme: dark`
Expected: readable contrast, no unstyled or invisible text.

### TC-UI-006 Icon-only buttons carry accessible names
Priority: P2 minor
Steps: 1. On the keywords page, count buttons with no text and no `aria-label`/`title`
Expected: zero.

### TC-UI-007 216 keywords render quickly and are virtualized
Priority: P1 major
Steps: 1. Hard reload `/apps/:id/keywords`; measure load and count `tbody tr`
Expected: loads in a few seconds; the DOM holds a windowed subset, not all 216 rows.

### TC-UI-008 Escape closes an open dialog
Priority: P2 minor
Steps: 1. Open the add-keyword dialog; 2. press Escape
Expected: the dialog closes.

### TC-UI-009 Sort headers are clickable and the table stays populated
Priority: P2 minor
Steps: 1. Click each of the first six column headers in turn
Expected: no error; rows remain rendered after every click.

### TC-UI-010 Browser back and forward
Priority: P2 minor
Steps: 1. Overview -> keywords; 2. Back; 3. Forward
Expected: each step lands on the right route and the table re-renders.

### TC-UI-011 Keyboard-only navigation
Priority: P2 minor
Steps: 1. On the keywords page press Tab 15 times, recording the focused element and
whether a focus ring is visible
Expected: a sane order through sidebar and controls, with a visible focus indicator.

### TC-UI-012 Offline then back online
Priority: P1 major
Steps: 1. Set the browser offline; 2. reload; 3. go back online; 4. reload
Expected: an explicit offline state rather than a blank page, and full recovery afterwards.

### TC-UI-013 Backend unreachable
Priority: P1 major
Steps: 1. Stop the API; 2. load `/apps/:id/keywords` as a signed-in user
Expected: the shell renders and an explicit error with a retry affordance appears within a
few seconds. No infinite spinner, no blank page.

### TC-UI-014 A store icon that fails to load
Priority: P3 cosmetic
Preconditions: an app whose stored `iconUrl` cannot be fetched
Steps: 1. Open any page showing the app switcher
Expected: a placeholder tile (as used when `iconUrl` is null), not overflowing alt text
overlapping neighbouring labels.

### TC-UI-015 Keyword scores display on the documented 0-100 scale
Priority: P2 minor
Steps: 1. Compare the TRAFFIC and DIFFICULTY cells against the API's `volume`,
`traffic` and `difficulty` fields for the same keyword
Expected: displayed values stay within 0-100 for any stored value, as
`toDifficulty100`/`toVolume` guarantee on the API side.

---

## REPO — the project's own suites

### TC-REPO-001 Unit and component suites pass at this commit
Priority: P0 blocker
Steps: 1. `pnpm run test` at the repository root
Expected: every workspace task passes.
