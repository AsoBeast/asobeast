## Summary
Five pages throw a React hydration error in a production build. The screen looks correct,
but React discards the server-rendered markup for the affected subtree and re-renders it in
the browser, so those pages lose the benefit of server rendering and log an uncaught error
in the console on every visit.

## Severity
P3 cosmetic
Impact: every user, on every visit to `/login`, `/register`, `/`, `/settings` and
`/apps/:id`. Nothing is visibly broken and there is no workaround needed, but the error is
noisy, it costs an extra client render on the two most-visited pages, and it will bury a
genuine hydration regression later.

## Environment
- Commit: 08225c3c60912d52521d849d2e01855e62e4da1a on claude/asobeast-regression-testing-f0udcj
- Stack: `next build` + `next start` (Next.js 16.3.3, React 19.2.8), API on Nest, PostgreSQL, Redis
- Browser: Chromium 1194 (Playwright), viewport 1440x900
- Account: owner, data state: QA seed (5 apps, 216 keywords)

## Steps to reproduce
1. Build and start the web app in production mode (`next build`, then serve it)
2. Open `http://localhost:3001/login` with the devtools console open
3. Observe the console
4. Repeat for `/register`, `/`, `/settings` and `/apps/<id>`
Reproducibility: 5/5 attempts on each of the five routes. `/forgot-password`, `/actions`,
`/tokens`, `/apps/:id/keywords`, `/rankings`, `/competitors`, `/reviews`, `/metadata`,
`/audit`, `/changes`, `/apps/:id/actions` and `/apps/:id/setup` are clean.

## Expected result
No hydration error. The server-rendered HTML matches the first client render, so React
hydrates in place.

## Actual result
An uncaught error on each of the five routes:

```
Minified React error #418; visit https://react.dev/errors/418?args[]=text&args[]=
```

`/settings` and `/apps/:id` report the `args[]=HTML` variant instead of `args[]=text`.
React's own text for #418 is "Hydration failed because the server rendered text/HTML didn't
match the client. As a result this tree will be regenerated on the client."

## Evidence
- Per-route run, fresh browser context each time, `qa/evidence/ui/findings.json`:
  ```
  HYDRATION  login          Minified React error #418 ... args[]=text
  HYDRATION  register       Minified React error #418 ... args[]=text
  clean      forgot-password
  HYDRATION  dashboard      Minified React error #418 ... args[]=text
  clean      actions
  HYDRATION  settings       Minified React error #418 ... args[]=HTML
  clean      tokens
  HYDRATION  app-overview   Minified React error #418 ... args[]=HTML
  clean      app-keywords ... app-setup
  ```
- The final DOM converges: rendering `/login` with JavaScript disabled and diffing every
  element and text node against the hydrated DOM shows no difference other than Next's own
  `<next-route-announcer>`. This is consistent with React recovering by re-rendering.
- `<html>` already carries `suppressHydrationWarning` (`apps/web/src/app/layout.tsx:55`), so
  the `next-themes` class and `color-scheme` swap on the root element is not the cause; the
  mismatch is in a descendant.
- Not reproducible under `next dev` on the same commit, so it needs a production build.

## Suspected cause
Hypothesis only, not verified, and deliberately not fixed as part of this pass.
`AuthGate` (`apps/web/src/components/auth/AuthGate.tsx`) branches its markup on
`useAuth()`'s `status` before that query has settled, returning a loader for
`blocked` and the children otherwise. If the server renders one branch and the client's
first render picks the other, the subtree mismatches. That would fit the affected set:
every failing route is one where the gate's branch depends on session state, and the two
`args[]=HTML` routes are the ones whose shell differs structurally rather than only in text.

## Related
TC-UI-003. Found during the 2026-09-04 regression pass; see `qa/report-2026-09-04.md`.
