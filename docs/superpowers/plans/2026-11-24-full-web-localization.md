---
title: "Full Web Localization Implementation Plan"
description: "Task by task plan for translating every first party web surface."
---

# Full Web Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete English and Simplified Chinese localization for every user-visible AsoBeast web surface without changing URLs, behavior, styling, API contracts, or shared protocol values.

**Architecture:** Keep the existing next-intl request config, locale cookie, provider, and catalog parity test. Add feature-scoped message namespaces, register them centrally, and replace hardcoded UI copy in components and pure copy helpers. Pure helpers accept a translator or return stable message descriptors; components remain responsible for rendering translated strings.

**Tech Stack:** Next.js App Router, next-intl 4.16.0, React 19, TypeScript strict, Vitest, Playwright, Turbopack.

**Spec:** `docs/superpowers/specs/2026-11-24-full-web-localization-design.md`

## Global Constraints

- Do not commit changes or alter unrelated user work.
- Do not change `@asobeast/shared` contracts, enum values, API responses, MCP tools, or protocol strings.
- Do not translate store-written, user-written, API-provided, operator-authored, or third-party checkout content.
- Preserve brands, product names, store names, codes, URLs, IDs, environment variables, command snippets, and technical identifiers.
- Message keys use camelCase and feature namespaces. English and zh-CN catalogs must have identical leaf paths and no empty values.
- Use ICU plurals, select, interpolation, and rich text instead of concatenated sentence fragments.
- Client components use `useTranslations`; server components use `getTranslations`.
- Pure copy helpers accept a translator or return stable message descriptors; they do not import React or call hooks.
- Use existing locale-aware formatting helpers and extend them where needed. Do not let `Intl` word a date joined with a time or a country name.
- Keep translator-safe text spans and accessible names intact.
- Replace selectors that match English visible text with stable `data-*` attributes or IDs.
- No source comments.
- Every task starts with a failing component or helper test that asserts Chinese output, then implements the minimal integration.
- Agents own only their assigned catalog files and component directories. Do not edit `src/i18n/messages.ts` after Task 1 registration.

## Review Focus

- ICU plurals and interpolation preserve correct Chinese word order and counts.
- Rich messages keep links inside the translated sentence without bare adjacent text nodes.
- Server/client component boundaries use the correct next-intl API and do not break streaming or hydration.
- Dynamic API/store/user content remains unchanged while surrounding UI copy is translated.
- Accessibility labels, tooltips, confirmations, CSV/report copy, and chart image captions follow the active locale.
- Locale preference survives navigation, reload, login, and error boundaries.
- Historical release notes and dense settings surfaces have complete, natural Simplified Chinese copy.
- Existing English E2E tests continue to pass because their browser locale remains English.

---

### Task 1: Localization infrastructure and shared foundation

**Files:**

- Create: `apps/web/messages/en/{ui,format,shell,seo,datePicker,validation,languages,legal,systemNotices}.json`
- Create: `apps/web/messages/zh-CN/{ui,format,shell,seo,datePicker,validation,languages,legal,systemNotices}.json`
- Create: empty catalogs for every feature namespace listed in Tasks 2 to 17 in both locales.
- Modify: `apps/web/src/i18n/messages.ts`
- Modify: `apps/web/playwright.config.ts`
- Modify: `apps/web/src/components/ui/{breadcrumb,chart,command,delta-chip,dialog,sheet,sidebar,sonner}.tsx`
- Modify: `apps/web/src/components/{ConfirmActionFooter,ExportCsvButton,StoreLinkButton,SubjectButton,CountrySelect}.tsx`
- Modify: `apps/web/src/components/data-table/*`
- Modify: `apps/web/src/components/day-picker/*`
- Modify: `apps/web/src/components/layout/{AppSidebar,SidebarNav,AppSwitcher,app-switcher-label,Breadcrumbs,CommandPalette,ThemeToggle,HealthBadge,SystemBanner,WhatsNewMenuItem,ErrorState,InlineQueryError,NotFoundCard,LegalLinks}.tsx`
- Modify: `apps/web/src/components/layout/{system-notice,health-answer,run-delay-notice,feed-row}.ts`
- Modify: `apps/web/src/lib/{error-recovery,format,grade,language-names,localizations,market,ranges}.ts`
- Modify: `apps/web/src/lib/chart-image/caption.ts`
- Modify: `apps/web/src/app/{layout,manifest,global-error,not-found}.tsx`
- Test: `apps/web/src/i18n/messages.test.ts`, focused component tests for shared primitives, shell, formatting, and errors.

**Interfaces:**

- Produces: all namespaces registered in `messageNamespaces` and `catalogs`.
- Produces: locale-first formatting helpers and translated shared UI labels.
- Produces: `PLAYWRIGHT_EXECUTABLE_PATH` support in Playwright config for local system Chrome.

- [ ] Add a failing shared-component test asserting Chinese close, dismiss, filters, export, shell, and error copy.
- [ ] Run it and verify it fails because shared components are still hardcoded.
- [ ] Create and register all English and zh-CN namespace catalogs, initially with the shared keys filled and feature catalogs empty.
- [ ] Localize shared primitives, table controls, date picker, shell, error recovery, metadata, manifest, and global error.
- [ ] Make formatting locale-first and add translated grade, language, localization, range, and chart caption labels.
- [ ] Add Playwright `launchOptions.executablePath` support from `PLAYWRIGHT_EXECUTABLE_PATH`.
- [ ] Run focused tests, catalog parity tests, TypeScript, and formatting checks.

### Task 2: Authentication and session flows

**Files:**

- Modify: `apps/web/messages/{en,zh-CN}/auth.json`
- Modify: `apps/web/src/components/auth/*`
- Modify: `apps/web/src/lib/{password,sign-up-steps}.ts`
- Test: focused auth component and helper tests.

**Interfaces:**

- Consumes: registered `auth`, `common`, `legal`, and `validation` namespaces.
- Produces: fully localized sign-in, registration, recovery, invitation, verification, confirmation, unsubscribe, session, and password flows.

- [ ] Add failing Chinese assertions for register, forgot password, reset password, invite, verify, confirm alert, unsubscribe, and session components.
- [ ] Implement `auth.*` messages and wire components and pure helpers.
- [ ] Keep API error matching sentinels and dynamic server messages unchanged.
- [ ] Run focused tests and TypeScript.

### Task 3: Billing and account plan

**Files:**

- Create: `apps/web/messages/{en,zh-CN}/{billing,account}.json`
- Modify: `apps/web/src/components/billing/*`
- Modify: `apps/web/src/components/auth/{AccountNotice,MemberBilling,UserMenu}.tsx`
- Modify: `apps/web/src/components/settings/{PlanSection,PlanCard,KeywordLimitNotice}.tsx`
- Modify: `apps/web/src/lib/{plan-choice,paywall-faq,order-summary,checkout-return,ai-allowance,quota-usage,plan-in-force}.ts`
- Test: billing/account component and helper tests.

**Interfaces:**

- Consumes: shared plan data and locale-aware formatters.
- Produces: localized paywall, plan cards, pricing, trial, renewal, checkout, portal, FAQ, and account plan copy without changing shared contracts.

- [ ] Add failing Chinese assertions for paywall heading, plan action, trial status, order summary, FAQ, and account plan notice.
- [ ] Refactor copy helpers to accept a translator or return descriptors.
- [ ] Localize all billing/account components and map stable plan/interval/action codes to message keys.
- [ ] Run focused tests and TypeScript.

### Task 4: Settings, team, workspace, checklist, and notifications

**Files:**

- Create: `apps/web/messages/{en,zh-CN}/{settings,team,workspace,notifications}.json`
- Modify: `apps/web/src/components/settings/*`
- Modify: `apps/web/src/components/checklist/*`
- Modify: `apps/web/src/lib/deletion-reasons.ts`
- Test: settings, team, deletion, checklist, alert-rule, channel, and delivery tests.

**Interfaces:**

- Consumes: `billing`, `account`, `common`, `validation`, and `navigation`.
- Produces: localized settings index, capacity/budget, team, workspace deletion, checklist, email alerts, webhooks, rules, thresholds, and delivery UI.

- [ ] Add failing Chinese assertions for settings headings, invite member, delete workspace, checklist goal, add email alert, add webhook, and delivery status.
- [ ] Localize all settings and checklist copy, including enum labels and ICU counts.
- [ ] Preserve event IDs, emails, URLs, secrets, environment variable names, and provider names.
- [ ] Run focused tests and TypeScript.

### Task 5: Dashboard, apps import, and setup

**Files:**

- Create: `apps/web/messages/{en,zh-CN}/{dashboard,apps,setup}.json`
- Modify: `apps/web/src/components/dashboard/*`
- Modify: `apps/web/src/components/apps/*`
- Modify: `apps/web/src/components/onboarding/*`
- Modify: `apps/web/src/lib/import-budget.ts` where display copy is produced.
- Test: dashboard, import, setup, and onboarding component/helper tests.

**Interfaces:**

- Consumes: `common`, `format`, `navigation`, and shared app data.
- Produces: localized portfolio dashboard, apps table/cards, import dialog, first run, setup checklist, market picker, keyword picker, and competitor picker.

- [ ] Add failing Chinese assertions for dashboard shell, apps table, import app, setup steps, and first-run states.
- [ ] Localize all dashboard/apps/setup copy and replace English plural suffixes with ICU messages.
- [ ] Run focused tests and TypeScript.

### Task 6: App overview, app detail, metrics, and jobs

**Files:**

- Create: `apps/web/messages/{en,zh-CN}/{overview,appDetail,jobs,metrics}.json`
- Modify: `apps/web/src/components/overview/*`
- Modify: `apps/web/src/components/app-detail/*`
- Modify: `apps/web/src/components/capacity/*`
- Modify: `apps/web/src/lib/{run-progress,funnel,utilization}.ts`
- Test: overview, app detail, run progress, health, and funnel tests.

**Interfaces:**

- Consumes: `format`, `common`, `navigation`, and locale-aware country names.
- Produces: localized app overview, metrics, store funnel, ratings, movers, run status, refresh, delisting, snapshot diff, and report headers.

- [ ] Add failing Chinese assertions for overview metrics, funnel help, run progress, refresh, and delisting notices.
- [ ] Localize components and pure copy helpers.
- [ ] Run focused tests and TypeScript.

### Task 7: Keywords core

**Files:**

- Create: `apps/web/messages/{en,zh-CN}/keywords.json`
- Modify: `apps/web/src/components/keywords/*` except `discovery/`, `sheet/`, `serp/`, and `map/`.
- Modify: `apps/web/src/lib/{keyword-insights,keyword-import,keyword-zones,keyword-tags,keyword-bulk,keyword-day-change,keyword-field-addition,trend-window,text-limit,wasted-words}.ts`
- Test: keyword table, import, filters, suggestions, bulk, annotations, and helper tests.

**Interfaces:**

- Consumes: `common`, `format`, `validation`, and `navigation`.
- Produces: localized tracked keyword table, add/import flows, filters, scores, positions, suggestions, combinations, bulk actions, tags, notes, and insights.

- [ ] Add failing Chinese assertions for keyword table headers, add/import dialog, filters, suggestions, and bulk actions.
- [ ] Localize components and copy helpers with ICU plurals.
- [ ] Run focused tests and TypeScript.

### Task 8: Keyword inspector, discovery, SERP, and opportunity map

**Files:**

- Create: `apps/web/messages/{en,zh-CN}/keywordInspector.json`
- Modify: `apps/web/src/components/keywords/{discovery,sheet,serp,map}/*`
- Modify: `apps/web/src/components/keyword-inspections/*`
- Modify: `apps/web/src/lib/keyword-discoveries.ts`
- Test: inspector, discovery, SERP, map, and keyword sheet tests.

**Interfaces:**

- Consumes: `keywords`, `common`, `format`, and `validation`.
- Produces: localized keyword inspector, discovery table/actions, SERP sheet, keyword detail sheet, position history, and opportunity map.

- [ ] Add failing Chinese assertions for inspector figures, discovery states, SERP sheet, keyword sheet, and map thresholds.
- [ ] Localize components and helpers while preserving store-provided result text.
- [ ] Run focused tests and TypeScript.

### Task 9: Rankings and competitors

**Files:**

- Create: `apps/web/messages/{en,zh-CN}/{rankings,competitors}.json`
- Modify: `apps/web/src/components/rankings/*`
- Modify: `apps/web/src/components/competitors/*`
- Modify: `apps/web/src/components/annotations/*`
- Modify: `apps/web/src/lib/{gap-lists,gap-headline}.ts`
- Test: rankings, competitors, gap analysis, comparison, and annotation tests.

**Interfaces:**

- Consumes: `common`, `format`, `keywords`, and shared enum data.
- Produces: localized rankings views, movers, competitor discovery/tracking, comparison matrix, gap analysis, standing panel, and annotations.

- [ ] Add failing Chinese assertions for rankings headers, mover states, add competitor, comparison matrix, and gap analysis.
- [ ] Localize components and helpers.
- [ ] Run focused tests and TypeScript.

### Task 10: Metadata, screenshots, and changes

**Files:**

- Create: `apps/web/messages/{en,zh-CN}/{metadata,screenshots,changes}.json`
- Modify: `apps/web/src/components/metadata/*`
- Modify: `apps/web/src/components/localizations/*`
- Modify: `apps/web/src/components/screenshots/*`
- Modify: `apps/web/src/components/changes/*`
- Modify: `apps/web/src/components/{MetadataFieldCard,KeywordFieldSuggestionCard}.tsx`
- Modify: `apps/web/src/lib/{metadata-display,screenshot-captions,app-localizations}.ts`
- Test: metadata, localization, screenshot, and change component/helper tests.

**Interfaces:**

- Consumes: `common`, `format`, `keywords`, and shared change field keys.
- Produces: localized metadata workbench, coverage, field editor, AI panel, screenshot captions, localization names, change timeline, impact, and field values.

- [ ] Add failing Chinese assertions for metadata coverage, field editor, screenshot captions, change timeline, and impact card.
- [ ] Localize components and helpers; map shared field/rule codes to web message keys.
- [ ] Run focused tests and TypeScript.

### Task 11: Audit

**Files:**

- Create: `apps/web/messages/{en,zh-CN}/audit.json`
- Modify: `apps/web/src/components/audit/*`
- Test: audit component/helper tests.

**Interfaces:**

- Consumes: `common`, `format`, `metadata`, and shared audit data.
- Produces: localized audit score, factors, checks, top fixes, readiness, benchmarks, AI panel, creative observations, and report export.

- [ ] Add failing Chinese assertions for audit heading, score panel, top fixes, readiness, and copy report.
- [ ] Localize components and helpers while preserving API factor/check text and AI output.
- [ ] Run focused tests and TypeScript.

### Task 12: Action Center

**Files:**

- Create: `apps/web/messages/{en,zh-CN}/actions.json`
- Modify: `apps/web/src/components/actions/*`
- Test: action queue, detail, bulk, history, outcome, evidence, and helper tests.

**Interfaces:**

- Consumes: `common`, `format`, `navigation`, and shared action rule keys.
- Produces: localized Action Center shell, filters, queue, details, evidence, steps, headlines, briefs, outcomes, history, shortcuts, charts, and toasts.

- [ ] Add failing Chinese assertions for Action Center heading, queue states, action detail, bulk controls, and outcome.
- [ ] Refactor pure action copy helpers to accept a translator or return descriptors.
- [ ] Replace English aria-label selectors with stable data attributes.
- [ ] Run focused tests and TypeScript.

### Task 13: Alerts feed, shared charts, and top charts

**Files:**

- Create: `apps/web/messages/{en,zh-CN}/{alerts,charts,topCharts}.json`
- Modify: `apps/web/src/components/alerts/*`
- Modify: `apps/web/src/components/charts/*`
- Modify: `apps/web/src/components/top-charts/*`
- Modify: `apps/web/src/lib/chart-image/*`
- Test: alert feed, chart states/image, top chart table/history/trending/follow tests.

**Interfaces:**

- Consumes: `common`, `format`, `navigation`, and shared chart/store data.
- Produces: localized alert feed, chart states/legends/tooltips/image captions, top chart filters/views/tables/history/trending/follow/capture UI.

- [ ] Add failing Chinese assertions for alert feed states, chart empty/insufficient states, image buttons, and top charts toolbar/table.
- [ ] Localize components and chart image captions.
- [ ] Replace English aria-label selectors with stable attributes.
- [ ] Run focused tests and TypeScript.

### Task 14: Reviews and ratings

**Files:**

- Create: `apps/web/messages/{en,zh-CN}/reviews.json`
- Modify: `apps/web/src/components/reviews/*`
- Test: review list, reply composer, translation, ratings, mentions, and export tests.

**Interfaces:**

- Consumes: `common`, `format`, `validation`, and shared review data.
- Produces: localized reviews toolbar/list, ratings charts/goals, reply composer/guidelines/posting, translation controls, mentions, and CSV UI.

- [ ] Add failing Chinese assertions for reviews heading, filters, reply composer, translation caption, and ratings goal.
- [ ] Localize components and helpers while preserving review/reply/AI text.
- [ ] Run focused tests and TypeScript.

### Task 15: Admin and support

**Files:**

- Create: `apps/web/messages/{en,zh-CN}/admin.json`
- Modify: `apps/web/src/components/admin/*`
- Modify: `apps/web/src/components/admin/workspace-sheet/*`
- Modify: `apps/web/src/lib/{admin-sections,admin-stages,admin-support,admin-conversion}.ts`
- Modify: `apps/web/src/app/(app)/admin/**/error.tsx`
- Test: admin overview, conversion, capacity, workspaces, users, apps, and support sheet tests.

**Interfaces:**

- Consumes: `common`, `format`, `navigation`, `errors`, and shared admin enums.
- Produces: localized operator shell, navigation, overview, conversion, capacity/proxy, workspace/user/app tables, support sheet, audit log, and support actions.

- [ ] Add failing Chinese assertions for admin heading/nav, overview tiles, conversion funnel, capacity, workspace table, and support actions.
- [ ] Localize components and helpers; map enum codes to message keys.
- [ ] Run focused tests and TypeScript.

### Task 16: Integrations

**Files:**

- Create: `apps/web/messages/{en,zh-CN}/integrations.json`
- Modify: `apps/web/src/components/integrations/*`
- Modify: `apps/web/src/lib/{store-connection-copy,mcp-snippets,mcp-token-scope}.ts`
- Modify: `apps/web/src/app/(app)/integrations/**/error.tsx`
- Test: store connection, API token, MCP, and Google Play OAuth tests.

**Interfaces:**

- Consumes: `common`, `format`, `validation`, and shared integration data.
- Produces: localized App Store Connect/Google Play setup, status, sync/disconnect, API token, MCP endpoint/setup, and OAuth return UI.

- [ ] Add failing Chinese assertions for integrations heading, App Store Connect steps, Google Play connect, API token creation, and MCP setup.
- [ ] Localize components and descriptive helper copy; preserve commands, snippets, IDs, keys, URLs, and environment variables.
- [ ] Run focused tests and TypeScript.

### Task 17: Release notes

**Files:**

- Create: `apps/web/messages/{en,zh-CN}/releaseNotes.json`
- Modify: `apps/web/src/components/whats-new/*`
- Modify: `apps/web/src/lib/whats-new/{first-releases,later-releases,release-notes,releases}.ts`
- Modify: `apps/web/src/app/(app)/whats-new/error.tsx`
- Test: release note view and catalog parity tests.

**Interfaces:**

- Consumes: `common`, `navigation`, and existing release metadata.
- Produces: localized What's New UI, release titles/summaries, change kinds, and all historical release note copy.

- [ ] Add a failing Chinese assertion for What's New heading, latest release, change kinds, and one historical entry.
- [ ] Move display copy into `releaseNotes.json` while keeping versions, dates, anchors, and URLs stable.
- [ ] Run focused tests and TypeScript.

### Task 18: Whole-app localization verification

**Files:**

- Create: `apps/web/e2e/localization.spec.ts`
- Modify: existing E2E specs only where selectors must become locale-independent.
- Test: full Web unit suite, TypeScript, ESLint, Prettier, Chromium E2E localization sweep, existing smoke/auth/settings/routes tests.

**Interfaces:**

- Consumes: completed catalogs and localized components from Tasks 1 to 17.
- Produces: deterministic real-browser proof that every route renders Chinese interface chrome and preserves locale through navigation/reload.

- [ ] Add a failing zh-CN route sweep using `SIGNED_IN_ROUTES` and `SIGNED_OUT_ROUTES`, asserting `lang="zh-CN"`, localized shell navigation, and expected page headings.
- [ ] Add targeted Chinese dialog/table/error assertions for import, settings, keywords, billing, admin, and reviews.
- [ ] Run the sweep with `PLAYWRIGHT_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- [ ] Run `pnpm --filter web test`, `pnpm --filter web exec tsc --noEmit`, `pnpm --filter web lint`, Prettier check, and selected existing Chromium E2E specs.
- [ ] Re-run the original login language-selection flow and confirm Chinese persists after reload.
- [ ] Report any remaining untranslated API/store/user content separately from interface copy.
