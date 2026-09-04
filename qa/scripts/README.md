# QA harness scripts

Written for the 2026-09-04 regression pass. They are test tooling, not product code.

- `../seed-qa.ts` — builds the edge-case dataset. Copy it into `apps/api/` and run
  `pnpm exec ts-node --project tsconfig.json --transpile-only qa-seed.ts` from there, so
  `@prisma/client` resolves.
- `qa-ui-sweep.mjs` — visits every route at 1440px and 375px, records console errors, page
  errors, failed requests, horizontal overflow and any XSS dialog, screenshots each page.
- `qa-hydration.mjs` — one fresh browser context per route, to isolate hydration errors.
- `qa-hydration-dev.mjs` / `qa-hydration-diff.mjs` / `qa-hydration-struct.mjs` — narrowing
  the hydration mismatch: dev-server messages, SSR-vs-hydrated text diff, and a full
  structural diff with JavaScript disabled.
- `qa-interact.mjs` — interactive pass: element inventory, dialogs, Escape, sort headers,
  back/forward, offline.
- `qa-cells.mjs` — reads the keyword table's header and cell text out of the DOM.
- `qa-savestate.mjs` — logs in and saves a Playwright storage state.
- `qa-backend-down.mjs` — loads an authenticated page with the API stopped.

Run the `.mjs` scripts from `apps/web` so `@playwright/test` resolves:

```bash
cp qa/scripts/qa-ui-sweep.mjs apps/web/ && cd apps/web && node qa-ui-sweep.mjs
```

Each expects the stack on `127.0.0.1:3001` (web) and `127.0.0.1:4000` (API), and reads app
ids from `qa/ids.env`.
