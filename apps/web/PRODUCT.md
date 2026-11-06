# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Scope

This record covers the signed-in application in `apps/web`: the dashboard, apps and their keywords, rankings, competitors, metadata, audit, changes, reviews and setup, the Action Center, alerts, top charts, integrations, settings and the operator `/admin` area. The sign in and registration pages, the `/upgrade` billing wall, the documentation site in `/docs` and the asobeast.com marketing page (which lives outside this repository) are out of scope for the current redesign.

## Users

The primary user is an indie developer who ships one to a few apps of their own on the Apple App Store and Google Play and does their own ASO. They open AsoBeast on their own, usually once a day after the daily run, to see whether their positions moved, what changed in their listing or their competitors' listings, which reviews need a reply and what the Action Center says to do next. Sometimes they sit down for a longer session to rework metadata, research keywords or add a market.

Secondary audiences, confirmed by the README: small studios and agencies tracking a handful of apps across several storefronts, self hosters running their own instance, and people who query their ASO history from an agent through the MCP server rather than the interface.

## Product Purpose

AsoBeast is an App Store Optimization tool and keyword rank tracker for both stores. It imports a listing from a store URL, snapshots its metadata, tracks keyword positions daily to a depth of 200 across many storefronts, scores keywords for popularity, difficulty and opportunity, watches competitors, reviews, ratings, chart positions and listing changes, and turns that history into a prioritized, explainable queue of ASO work. Success is a developer who knows within a minute of opening the app what moved and what to do about it, and who trusts the numbers enough to act on them.

## Positioning

- Open source under AGPL-3.0 with no open core: the hosted service at asobeast.com runs the same code as the self hosted edition.
- Every store request runs from the machine hosting AsoBeast as an ordinary public request. No ASO vendor, no vendor API key, and the keyword list is never shared with a third party.
- Every score shows its evidence: popularity and difficulty carry their source, calculation version, capture date and confidence.
- Recommendations are deterministic rules over stored history. AI is optional and may only summarize or draft; it never creates, ranks or suppresses an action.
- One app is one tracking entity across storefronts, so markets are views of the same listing rather than separate subscriptions.
- The same data is available to agents through an MCP server and to scripts through a documented HTTP API.

## Operating Context

- The daily pipeline runs once a day (03:00 UTC by default) and alerts are batched after it completes, so the typical visit is a morning check of what changed since yesterday.
- Owners also run on demand actions (refresh a listing, run daily, score keywords), which are rate limited by store capacity and answer "queued" rather than instantly.
- The App Store keyword field is private and typed by hand on the metadata page; it cannot be scraped.
- Optional connections: App Store Connect and Google Play console keys for the store funnel, SMTP email and webhook alerts (Slack, Discord and similar), OpenAI compatible models for drafts, Apple Ads for search popularity.
- Users export CSV and chart images to share outside the app.
- Interface text, release notes and the What's new page are written in plain language for the person using AsoBeast, without code, paths or internal names.

## Capabilities and Constraints

- Two live stores. Google Play has no subtitle and no keyword field; those stay App Store concepts and are hidden for Play apps.
- Position is 1 based; a checked keyword that was not found is shown as `>100` or `>200` from its depth, never `0`. A keyword not yet checked reads **Checking…**.
- Popularity, difficulty and opportunity are 0 to 100 scores; judged numbers carry a grade word (strong, fair, weak, poor) as well as a colour.
- Both light and dark themes are first class. Layouts must hold at 320 px width with the collapsible sidebar shell.
- The interface must survive browser page translation and render identically in WebKit, Chromium and Node (no engine-worded dates or country names).
- Built on Next.js App Router, Tailwind, owned shadcn primitives in `components/ui`, Recharts through the chart system in `components/charts/theme.ts`, and the TanStack table kit in `components/data-table/`.
- Terminology the interface uses: market or storefront, localization, keyword field, position, popularity, difficulty, opportunity, visibility, Action Center, competitor, top charts, store funnel.
- The HTTP contract, shared types and MCP tools are frozen for the 1.x line; a redesign changes presentation only and must not require a contract change.

## Brand Commitments

- The product name is written **AsoBeast** in interface text and lowercase only in technical identifiers.
- The logo mark (`public/brand/mark.png`, `public/brand/email-mark.png`, app icons in `public/icons`) stays.
- The brand orange of the landing page stays as the colour of action in the app.
- IBM Plex Sans and Mono, the existing palette beyond the orange, radii, card treatment and the rest of the current look are not binding and may be replaced.
- The visual bar for the signed in app is the category standard played straight, at the finish level of Vercel (overview: metric tabs that drive one chart, tinted delta pills, a dashed segment for the unfinished day), Plausible (calm density, breakdown lists with inline bars), Linear (the dark theme, dense table discipline) and Adapty (clean layouts and charts), with Stripe's metric tiles and current versus previous period line as a detail. Chosen by the owner on 2026-11-06 after a round of themed directions was rejected as not how professional products look.

## Evidence on Hand

- Product screenshots in `docs/images/` (for example `docs/images/overview/overview-dark.png`) and the typed mock API used by the Playwright suite (`apps/web/e2e/mock-api.mts`) for realistic rendered states.
- The README and documentation at docs.asobeast.com describe every feature truthfully.
- No customer testimonials, customer logos, usage numbers or press are on hand. None may be invented in the interface.
- Redesign motivation: an outside viewer said the current app looks AI generated.

## Product Principles

1. **What moved, then why.** The daily visit must answer what changed since yesterday before anything else, with the evidence one step away.
2. **Show the evidence.** Every number can explain where it came from; nothing is presented as more certain than the data allows.
3. **Rules over magic.** Recommendations are explainable and stable; AI is clearly marked assistance, never the source of truth.
4. **The data is the owner's.** Nothing in the interface implies a vendor, an account elsewhere or data leaving the deployment unless the owner turned it on.
5. **Built for the person who comes back every day.** Favour scanability and density a returning user can read at a glance over first-visit spectacle.

## Accessibility & Inclusion

- WCAG AA contrast in both themes, enforced by axe `color-contrast` across every route (`e2e/contrast.spec.ts`).
- Colour is never the only signal; keyboard focus never falls to `body`; controls that start a request stay focusable; icon-only buttons and popovers carry accessible names; visible labels stay inside accessible names.
- User written store text (reviews, replies) may be right to left and is rendered with `dir="auto"`.
- Reduced motion and touch use are supported; metric explanations open on click or tap, not hover.
