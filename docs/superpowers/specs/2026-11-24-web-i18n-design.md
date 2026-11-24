# Web internationalization design

Date: 2026-11-24
Status: Proposed
Branch: `feat/web-i18n`

## Intent

Chinese users currently meet an English only interface before they can sign in and throughout the signed-in application. Add a real language preference with English and Simplified Chinese, default to the viewer's browser language when possible, and remember an explicit choice. The URL, HTTP contract, database schema and MCP surface stay unchanged.

## Goals

- Provide English and Simplified Chinese (`zh-CN`) for every first-party web surface a user can reach.
- Cover sign-in, registration, password recovery, verification, invitation, email link landings, the billing wall, the signed-in app, first-party admin pages, global loading and error states, and What's New.
- Translate interface copy, navigation, forms, dialogs, tables, chart labels, tooltips, empty states, toasts, accessibility names, CSV headers and known error recovery copy.
- Keep store supplied content in its original language. App names, listings, keywords, reviews and replies are data, not interface copy.
- Preserve existing routes, query parameters, authentication redirects, browser history behavior and the 1.x compatibility promise.
- Make the message catalog type safe, complete for both locales and straightforward to extend with another language later.

## Non-goals

- Translate the public marketing site, Mintlify documentation, alert and transactional emails.
- Translate the proxied Swagger UI or Bull Board. They are third-party operator surfaces.
- Translate App Store or Google Play content, user reviews or user written replies.
- Translate server-authored normal content such as stored alert sentences, dynamic audit explanations, AI summaries and generated recommendations. Those require an API and content-model project; their surrounding interface is translated.
- Add Traditional Chinese, right-to-left layouts or locale-specific URLs in this change.
- Change Stripe Checkout's language. Its session remains `locale: 'en'` as required by the billing rules.
- Change API error envelopes, shared contract types, MCP tools or persisted models.

## Constraints

- Next.js 16.4.5 App Router, React 19, strict TypeScript and the existing Tailwind and shadcn system.
- The app defines no Server Actions. Locale switching must not introduce one.
- `router.refresh()` is banned. A language change uses a full document navigation to the same URL.
- Dates remain UTC. Storefront names must not depend on engine-worded `Intl.DisplayNames`, because WebKit, Chromium and Node can disagree during hydration.
- Store prices continue to use the existing currency rules and `en-US` currency formatting.
- Text must remain safe for browser page translation: one changing string per element, text runs inside spans, stable keys and preserved focus behavior.
- Billing sentences remain owned by `lib/plan-choice.ts`, `lib/order-summary.ts`, `lib/paywall-faq.ts` and `planRenewalTerms` in `@asobeast/shared`.
- Source and tests contain no comments.
- The HTTP contract, `@asobeast/shared` contract types and MCP tool surface remain compatible for all of 1.x.

## Approaches

### 1. `next-intl` with a locale cookie and unchanged URLs

Use `next-intl` for message lookup, ICU interpolation, plurals and locale aware formatting. Resolve the locale on the server from a cookie, then `Accept-Language`, then English. Provide the same locale and messages to Client Components. A language switcher writes the cookie and navigates to the current URL.

This fits an authenticated app, keeps every existing link and redirect valid, and avoids rebuilding the proxy and route tree. It adds one maintained dependency and requires migrating hardcoded copy into message catalogs.

### 2. Custom dictionary and React context

Load a typed dictionary from a cookie and expose it through a React context. No dependency is added, but the project would own locale negotiation, interpolation, plural rules, formatting, server and client providers, message validation and switching behavior. With more than thirty pages, this creates a new internal framework and more long-term maintenance.

### 3. Locale prefixed routes

Move the app below `[locale]` and use URLs such as `/zh-CN/login`. This is useful for public SEO, but it changes every URL and interacts with authentication redirects, `next` parameters, proxy rules, cookies, tests and external links. The backend does not need indexed language variants, so this cost is not justified.

## Selected approach

Use approach 1.

### Locale resolution

Supported locales are `en` and `zh-CN`. The server resolves them in this order:

1. A valid `asobeast_locale` cookie.
2. The browser's `Accept-Language` header. `zh`, `zh-CN`, `zh-Hans` and other Simplified Chinese tags select `zh-CN`. English or an unsupported language selects `en`.
3. English.

An invalid or unsupported cookie falls back to browser detection. The resolved locale is validated before any dynamic message import. The root layout renders `<html lang={locale}>`.

The first visit follows the browser language. An explicit selection wins on later visits. The cookie is `SameSite=Lax`, `Path=/`, and lasts one year. It contains no personal data.

### Switching language

Add one shared `LanguageSwitcher` control:

- On signed-out pages, place it beside the theme toggle in `SignedOutHeader`.
- In the signed-in app, place it in the user menu and expose the same control in Settings for discoverability.

The control lists each language in its own name: `English` and `简体中文`. Selecting a language writes `asobeast_locale`, then performs a full document navigation to the current path, query string and hash. This preserves deep links and avoids both Server Actions and `router.refresh()`. Focus moves to the document heading after navigation, consistent with the existing focus rules.

### Provider and message layout

Add `next-intl` to `apps/web` and configure its Next.js plugin. Add a request configuration under `apps/web/src/i18n/` that resolves the locale and loads messages.

Store messages by feature namespace so the catalog remains navigable:

```text
apps/web/messages/
  en/
    common.json
    navigation.json
    auth.json
    billing.json
    dashboard.json
    apps.json
    keywords.json
    rankings.json
    competitors.json
    metadata.json
    audit.json
    changes.json
    reviews.json
    actions.json
    alerts.json
    charts.json
    settings.json
    integrations.json
    admin.json
    errors.json
    countries.json
    whats-new.json
  zh-CN/
    ...same namespaces...
```

The request configuration merges the namespace objects and passes them to `NextIntlClientProvider` in the root layout. English is the source of truth for message keys. A test requires identical key sets, valid ICU syntax and no empty translations. Missing translations fail CI rather than silently showing English.

The initial provider may send the complete catalog to Client Components. Measure the serialized payload during implementation. If it exceeds 150 KB gzipped, split feature messages into route-level providers before release.

### Formatting

- Replace hardcoded dates, relative times, lists and count phrases with locale aware formatting. Keep every date pinned to UTC.
- Use `zh-CN` date order and a 24-hour clock in Chinese. Keep the `UTC` suffix, translated as `UTC`.
- Keep `formatPrice` currency formatting pinned to `en-US`. Translate the zero price label `Free` as `免费` without changing currency symbols or fraction rules.
- Add a static Simplified Chinese country name map with the same keys as `COUNTRY_NAMES`. `formatCountry` accepts the locale. Do not use `Intl.DisplayNames` for storefront names.
- Use ICU plural messages for English count phrases. Chinese uses the same message without plural branching.
- Keep search parameter names, local storage keys, cookie names, API paths, enum values and CSV data values unchanged.

### Errors and refusals

Known HTTP statuses and network failures use the existing recovery model, with localized titles, bodies and actions in `errors.json`. This covers 401, 402, 403, 404, 429, 504, lost requests and scoped admin refusals.

For validation errors that contain useful field specific text, show a localized summary and retain the original server message in an expandable technical details region. Common authentication refusals use precise tested Chinese mappings, including invalid credentials, duplicate registration and expired or invalid links. For unexpected 5xx responses, show a localized generic message plus the existing error digest. Do not change the API envelope or expose a digest as user-facing prose.

### Copy ownership and rich text

- Sentences with links or emphasized values use `next-intl` rich text so the existing spans, focus behavior and accessible names survive.
- Billing copy stays in its canonical files. Those functions accept a locale-specific copy object or translator rather than moving billing sentences into unrelated components.
- What's New keeps structured release data and adds a parallel `zh-CN` catalog keyed by version. A parity test requires a Chinese entry for every release visible in the Chinese UI.
- Product names, store names, technical identifiers and user supplied text are not translated.

### Terminology

Use one consistent Chinese glossary across all namespaces:

| English             | Simplified Chinese |
| ------------------- | ------------------ |
| workspace           | 工作区             |
| market / storefront | 市场               |
| localization        | 本地化版本         |
| listing             | 应用详情页         |
| metadata            | 元数据             |
| keyword             | 关键词             |
| keyword field       | 关键词字段         |
| position / ranking  | 排名               |
| popularity          | 热度               |
| difficulty          | 难度               |
| opportunity         | 机会分             |
| visibility          | 可见度             |
| Action Center       | 行动中心           |
| competitor          | 竞品               |
| top charts          | 榜单               |
| daily run           | 每日运行           |
| audit               | 审计               |
| review              | 评论               |
| reply               | 回复               |
| alert               | 提醒               |
| integration         | 集成               |
| token               | 令牌               |
| plan                | 套餐               |
| trial               | 试用               |

## Scope inventory

### Foundation

- Dependency and Next.js plugin.
- Locale resolution, cookie parsing, browser language matching and validation.
- Root provider, `<html lang>` and shared formatter helpers.
- Message key parity and ICU validation tests.
- Shared language switcher.

### Shell and entry

- Global navigation, breadcrumbs, command palette, user menu, theme control labels, health states and sidebar footer.
- Sign-in, registration, forgot and reset password, email verification, invitation, unsubscribe, alert confirmation and link landing pages.
- Global `loading.tsx`, `error.tsx`, `not-found.tsx` and metadata.

### Core product

- Dashboard, app overview, setup, keywords, rankings, competitors, metadata, audit, changes, reviews and app actions.
- Tables, filters, sheets, dialogs, charts, tooltips, exports and all empty, loading and error states.

### Secondary product

- Workspace Action Center, alerts, top charts, keyword inspector, integrations, settings and What's New.
- Billing wall and account entry steps, while keeping Stripe Checkout in English.
- First-party operator admin pages. Swagger UI and Bull Board remain out of scope.

## Delivery sequence

One branch, `feat/web-i18n`, with separate conventional commits:

1. Add the internationalization foundation, locale resolution, provider, formatter changes and catalog tests.
2. Translate the shell, authentication pages and global states.
3. Translate the core app pages and their feature components.
4. Translate secondary pages, billing and first-party admin.
5. Finish What's New, country names, error recovery, translation coverage tests and accessibility checks.

Each step keeps the app buildable and the existing tests green. No API, database or MCP changes are expected.

## Verification

- Unit tests for locale precedence, unsupported cookies, browser language matching, message parity, ICU parsing, country names, formatting and error recovery.
- Component tests for the language switcher, cookie value, same-URL navigation and auth form copy.
- Playwright tests for:
  - A Chinese browser landing on Chinese sign-in without a cookie.
  - Switching English and Chinese on auth and signed-in routes.
  - Persistence after reload and correct behavior on a deep link with query parameters.
  - Representative routes in both languages, including tables, dialogs, charts, billing and admin.
  - Mobile widths 320 and 375 px, keyboard focus, translated accessible names and dark mode.
  - No hydration warnings in Chromium and WebKit.
  - Existing browser-translation safety tests still passing.
- Run `pnpm lint`, `pnpm test` and `pnpm build`. Run the web Playwright suite with the mock API. No store calls are introduced.
- Add a plain-language What's New entry for the visible feature in the same pull request.

## Risks and mitigations

- **Large copy surface.** Migrate by namespace and keep each step green. A parity test prevents silent English fallback.
- **Translation quality.** Use the glossary, review high-traffic and billing copy by hand, and keep user facing Chinese concise.
- **Hydration differences.** Use static country names, one formatter implementation and the existing WebKit hydration sweep.
- **Client payload growth.** Measure the message payload and split providers by route if needed.
- **English API messages.** Localize known recoveries and use a clear fallback with technical details for the rest.
- **Layout pressure.** Chinese is usually more compact, but test every header, table and dialog at the existing narrow breakpoints.
- **Browser translator interaction.** Keep the existing text-in-spans and stable-key rules, and rerun the translated-page tests.

## Left to the builder

- Exact namespace boundaries within a feature folder.
- The internal helper names and cookie utility implementation.
- Whether route-level message providers are needed after measuring the payload.
- Commit boundaries inside each delivery step, provided each commit is one logical change and keeps tests green.
