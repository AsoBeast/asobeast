## Summary
When an app's stored icon cannot be loaded, the app switcher shows the app's name as raw
overflowing alt text that spills out of the icon tile and overlaps the app title next to it,
instead of falling back to the letter placeholder the app already uses when there is no icon
at all.

## Severity
P3 cosmetic
Impact: any installation where a stored icon URL stops resolving. Reachable in normal
operation: a store icon URL that later 404s, a machine whose egress cannot reach the store
CDN, or an icon served from a host outside the two allowed remote patterns
(`**.mzstatic.com`, `**.googleusercontent.com`), which Next's image optimizer answers with
400. Cosmetic only; the page is still usable.

## Environment
- Commit: 08225c3c60912d52521d849d2e01855e62e4da1a on claude/asobeast-regression-testing-f0udcj
- Stack: `next build` + `next start` (Next.js 16.3.3), API on Nest, PostgreSQL, Redis
- Browser: Chromium 1194 (Playwright), viewport 1600x1000
- Account: owner, data state: QA seed

## Steps to reproduce
1. Have a tracked app whose `iconUrl` is set but cannot be fetched (in this run,
   `https://example.invalid/icon-primary.png`; a URL on any non-allowlisted host reproduces
   it because the optimizer returns 400)
2. Sign in and open any page inside `/apps/<id>`
3. Look at the app switcher at the top of the sidebar
Reproducibility: 5/5 attempts.

## Expected result
The same graceful fallback `AppIcon` already renders when `src` is null: a rounded tile
showing the first letter of the app name, sized to `size`, clipped to its box.

## Actual result
The `next/image` element fails to load and the browser paints its `alt` text unstyled and
unclipped. The app name renders twice, once as wrapped alt text inside the 32px tile and
once as the real label, and the two overlap.

## Evidence
- Screenshot: `qa/evidence/ui/keywords-table-wide.png` (top-left of the sidebar, the app
  name is drawn over itself)
- Network, observed on every page that renders the switcher:
  `GET /_next/image?url=https%3A%2F%2Fexample.invalid%2Ficon-primary.png&w=48&q=75` -> 400
- Console: `Failed to load resource: the server responded with a status of 400 (Bad Request)`

## Suspected cause
Hypothesis, not fixed here. `apps/web/src/components/AppIcon.tsx` handles only the
`src === null` case. When `src` is present there is no `onError` handling, so a failed load
falls through to the browser's default alt-text rendering.

## Related
TC-UI-014. See `qa/report-2026-09-04.md`.
