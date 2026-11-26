# Full Web Localization Design

## Intent

Complete the existing English and Simplified Chinese localization for the AsoBeast web application so a viewer who selects 简体中文 sees Chinese interface copy on every signed-in, signed-out, billing, settings, integration, and operator surface. Store-written content, user-written content, API error envelopes, brand names, protocol identifiers, and technical codes remain unchanged.

## Goals

- Route every user-visible interface string through next-intl message catalogs.
- Keep the existing locale cookie and URL structure unchanged.
- Preserve accessibility names, pluralization, interpolation, and translator-safe text nodes.
- Keep English and Simplified Chinese catalogs structurally identical and fully populated.
- Cover loading, empty, error, confirmation, toast, table, chart, form, and metadata copy.
- Verify with unit tests, type checking, formatting, and real-browser route sweeps in both locales.

## Non-goals

- Translating the Mintlify documentation site or the external marketing site.
- Translating email templates or API response messages.
- Translating App Store or Google Play listing content, reviews, screenshots, or user-entered text.
- Adding locale-specific URLs, a locale middleware, or a third locale.
- Changing product behavior, layout, styling, or the HTTP contract.

## Constraints

- Next.js App Router, next-intl 4.16.0, React 19, TypeScript strict.
- Existing locale resolution uses the `asobeast_locale` cookie and `Accept-Language`.
- `apps/web/src/i18n/messages.ts` owns catalog registration and parity checks.
- No source comments, per repository rules.
- Visible text stays inside the existing span and translator-safety patterns.
- Dates, numbers, lists, relative time, and country names use locale-aware helpers without engine-worded date-time joins.
- Message keys use camelCase and feature namespaces; ICU messages handle plurals and interpolation.
- Brand, store, protocol, status-code, and identifier strings remain literal.

## Approaches

### 1. Complete next-intl integration across feature namespaces

Create one message namespace per feature area, register each in `messages.ts`, and replace hardcoded UI copy in components and pure label helpers with translated messages or locale-aware keys. This preserves the current architecture, supports server and client components, and makes parity testable.

Trade-off: many files change, but the result is explicit, reviewable, and consistent.

### 2. Rely on browser page translation

Leave source copy in English and let the browser translate the page.

Rejected: it is not a product feature, cannot be tested deterministically, breaks React hydration and accessibility names, and does not respect the existing locale preference.

### 3. Add locale URL segments such as `/zh-CN/...`

Move localization into routing and middleware.

Rejected: it changes every URL, conflicts with the existing cookie-based preference, and expands the scope beyond interface copy.

## Chosen Approach

Use approach 1. The existing locale resolver, cookie, provider, and catalog parity test stay. New catalogs are split by feature so independent surfaces can be implemented and reviewed without shared-file conflicts. Shared primitives receive only the small set of cross-cutting labels they need.

## Terminology

- Workspace: 工作区
- Dashboard: 仪表盘
- Action Center: 行动中心
- Alerts: 提醒
- Top charts: 榜单
- Keyword inspector: 关键词检查器
- Integrations: 集成
- Settings: 设置
- App: 应用
- Market / storefront: 市场 / 应用商店地区
- Localization: 本地化
- Keyword field: 关键词字段
- Position: 排名
- Popularity: 热度
- Difficulty: 难度
- Opportunity: 机会
- Visibility: 曝光度
- Competitor: 竞品
- Review: 评论
- Metadata: 元数据
- Audit: 审计
- Screenshot: 截图
- Store funnel: 商店漏斗

## Definition of Done

- Every user-visible web string in the scoped surfaces resolves through a registered catalog.
- English and Chinese catalogs have identical key sets and no empty values.
- No signed-in or signed-out route renders untranslated interface chrome in 简体中文.
- Store content, user content, and technical identifiers remain unchanged.
- All Web unit tests, TypeScript checks, formatting checks, and targeted component tests pass.
- A real-browser sweep covers the shell, auth, dashboard, dialogs, tables, empty states, and error states in both locales.
