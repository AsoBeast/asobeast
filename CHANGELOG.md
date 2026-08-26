# Changelog

All notable changes to asobeast are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [1.1.0](https://github.com/AsoBeast/asobeast/compare/v1.0.0...v1.1.0) (2026-08-26)


### Features

* **api:** serve the stored App Store keyword field ([babe18d](https://github.com/AsoBeast/asobeast/commit/babe18d347b1530f3bdc8100cd5e8fc36bf2c38a))
* **competitors:** name the store on the discovery panel ([923faa1](https://github.com/AsoBeast/asobeast/commit/923faa129eef7a2cab959ee02f4e89a5090f2be4))


### Bug Fixes

* **alerts:** keep a pressed toggle still under the pointer ([9948994](https://github.com/AsoBeast/asobeast/commit/994899424128cbaa33b687b19a1251dddad3053d))
* **alerts:** keep a pressed toggle still under the pointer ([ac2185f](https://github.com/AsoBeast/asobeast/commit/ac2185f5c624ca8e8172538c908ee2db553c6efa))
* **api:** forgive an empty review feed for an app with no recent reviews ([0f550fd](https://github.com/AsoBeast/asobeast/commit/0f550fde48fa3740ebeab72c9dfdddc10c9d5ce1))
* **auth:** give the sign in and create account pages a page heading ([e299cac](https://github.com/AsoBeast/asobeast/commit/e299cac6a0668e106ef5a1878fd56649bf0551dc))
* **competitors:** match the add competitor example to the app store in view ([7f0cc0e](https://github.com/AsoBeast/asobeast/commit/7f0cc0e6c41ee30cfab68610204a2d2b2503b733))
* **competitors:** track a discovered app on the store it came from ([c6b9470](https://github.com/AsoBeast/asobeast/commit/c6b9470176db57dacb9c29f9c13e261bfc995628))
* **competitors:** track a discovered app on the store it came from ([d08f940](https://github.com/AsoBeast/asobeast/commit/d08f9406044e9fd5f6b23b46cabdff8a7833cffb))
* forgive quiet review feeds, give the auth pages a heading, hide play subtitle coverage ([f179c81](https://github.com/AsoBeast/asobeast/commit/f179c814ac9e0103dab3f599c5883e79abd0a232))
* **jobs:** stop retrying a plausibility rejection ([56e954f](https://github.com/AsoBeast/asobeast/commit/56e954fa3e7216b922c6a0211d144ef78cfb5628))
* **keywords:** auto track a snapshot without racing a concurrent sync ([cfa0853](https://github.com/AsoBeast/asobeast/commit/cfa085307f93634433a3275555c2425f62a922df))
* **keywords:** write a keyword and its tracking without racing another request ([0b9f639](https://github.com/AsoBeast/asobeast/commit/0b9f639ee123e00e621fe47e9b0946a77c25f1db))
* **keywords:** write a keyword and its tracking without racing another request ([5089d15](https://github.com/AsoBeast/asobeast/commit/5089d1575feb0945c4198ad9653f5a487ef91987))
* **shared:** raise the per minute request budgets above the dashboard cost ([45ed8a1](https://github.com/AsoBeast/asobeast/commit/45ed8a1e7046d31676eaa65d6d230fb6f4328543))
* **web:** blame the plan budget only when the plan refused the request ([c3b0dfc](https://github.com/AsoBeast/asobeast/commit/c3b0dfcf54440bea500228d098cb9cb8c00dadba))
* **web:** hide subtitle coverage for google play apps ([d98b328](https://github.com/AsoBeast/asobeast/commit/d98b3283f6b749d8b3a16d339d1ee236b366c5da))
* **web:** keep a server render from retrying a failed query ([cc0c2f1](https://github.com/AsoBeast/asobeast/commit/cc0c2f1423dac1f304fb016d7e059a55c9d5416b))
* **web:** let an emptied keyword field be saved ([69e1940](https://github.com/AsoBeast/asobeast/commit/69e194021b63486a0c2cc8353d51770464afb441))
* **web:** restore the App Store keyword field after a reload ([eaea8bd](https://github.com/AsoBeast/asobeast/commit/eaea8bd6f5fe3c395b97bcb774cdc36178d6f3b7))
* **web:** restore the keyword field editor from the stored value ([260728b](https://github.com/AsoBeast/asobeast/commit/260728bddf67a66c0417bd581ac7c9a4b02e72c1))
* **web:** show the plan rate limit reason instead of the generic error ([efd6133](https://github.com/AsoBeast/asobeast/commit/efd613368c150695ec956790a26347b353ad343f))
* **web:** stop retrying a refused request before Retry-After elapses ([aa3e5b9](https://github.com/AsoBeast/asobeast/commit/aa3e5b90578282bd26e63a6a59e6f6ccfd774b98))
* **web:** stop the dashboard exhausting the trial read budget ([2353723](https://github.com/AsoBeast/asobeast/commit/2353723ce9900c18ccab836c9e89df2fdee8d6c0))


### Performance

* **web:** prefetch app detail on intent instead of on sight ([2808efa](https://github.com/AsoBeast/asobeast/commit/2808efae7b10be1da3841b60e985ac08c6d550cb))


### Refactoring

* **alerts:** expose the event toggles as a labelled group ([7547527](https://github.com/AsoBeast/asobeast/commit/754752747b0ab08c5b130a6fe02e51c4e002a3d9))
* **api:** move the implausible result rule beside the store providers ([f9003e9](https://github.com/AsoBeast/asobeast/commit/f9003e9207fd751cdf0bc5f276285408b373fcf5))
* **api:** name the plausibility input for both of its callers ([4fafe31](https://github.com/AsoBeast/asobeast/commit/4fafe316a842914f6311eedf8b48968a26adfcf9))


### Documentation

* **docs:** document the keyword field read endpoint ([c1c39ce](https://github.com/AsoBeast/asobeast/commit/c1c39ce338c488afb10867d178f1b9e8e948cf4c))
* **docs:** restate the published rate limits ([46e3a8c](https://github.com/AsoBeast/asobeast/commit/46e3a8c85a916a54527d68bd99d1af235ab7fdb3))

## 1.0.0 (2026-08-24)

The first public release.

### Highlights

- **Tenancy is enforced by the database.** Every tenant-owned table carries a `tenant_isolation` row level security policy reading `app.workspace_id`, and every Prisma operation runs in a transaction that enters the workspace and drops to the non-owner `asobeast_app` role. A query with no workspace in scope returns nothing rather than everything. Work that genuinely spans tenants goes through a single `CrossTenantAccess` escape hatch that demands a written justification, and a dedicated isolation suite (`pnpm --filter api test:isolation`) proves it on every pull request.
- **Plans, quotas and billing.** Plans and their limits are typed data in `@asobeast/shared`; entitlement lives on `Workspace` rather than `User`, because a workspace has one plan whatever the size of the team. Stripe delivers checkout, the customer portal, idempotent subscription webhooks, daily reconciliation, period-end downgrades and cancellations, card-free trials and payment-failure notices. `BILLING_ENABLED=false` keeps a self-hosted install single-workspace and entirely free of it.
- **A proxy pool for store requests.** `PROXY_PROVIDER=webshare` reconciles a pool against the provider, spreads store requests across endpoints under a per-endpoint budget, classifies failures, tracks endpoint health and exposes it to operators. A residential fallback is available behind a hard monthly cost ceiling that refuses every request at `0`. `PROXY_PROVIDER=none` keeps every request on the host address, exactly as before.
- **The daily pipeline fans out per workspace.** Runs interleave across workspaces, degrade in a defined order under capacity pressure, and report per-workspace budget and projected completion. A keyword two workspaces track is still one search.
- **Rate limits everywhere.** Every endpoint is classified by cost and limited per workspace from Redis-backed counters, answering with standard rate limit headers and typed limit errors. Sustained abuse is flagged, and an operator can suspend a workspace by hand.
- **A remote MCP endpoint.** `POST /mcp` serves the same read-only tool catalog as the stdio binary from one shared definition in `@asobeast/mcp-tools`, authenticated by an `asob_` token, entitlement-checked and rate limited per workspace. Both surfaces now run `@modelcontextprotocol/server@2.0.0` and serve protocol `2026-07-28` alongside the 2025 revisions.
- **Operations you can run.** Structured logging with tenant and correlation context, per-workspace operational metrics, capacity and anomaly alerting, optional cloud-only error tracking with scrubbing, owner-only support tooling, and in-app delay notices for affected customers.
- **Account and data rights.** Password recovery from the login card with single-use tokens that reset every other session, workspace member invitations, personal API tokens with expiry and a read-only scope, and complete workspace export and deletion.
- **Packaging.** `docker-compose.pull.yml` runs the published GHCR images without a clone or a build, completing the pinned-image path promised for this release.

### Install notes

- **Migrations are additive and forward only.** The API applies them on boot. Take a database backup before any upgrade regardless; see [Backups](docs/operations/backups.mdx) and [Restore](docs/operations/restore.mdx).

- **Row level security changes who may run migrations.** Migrations and the seed must run as a role that bypasses the policies, which is the superuser the images already use. A deployment that runs migrations as a restricted role needs to change that before upgrading.
- **A self-hosted install needs no configuration change.** `BILLING_ENABLED` defaults to `false`, `PROXY_PROVIDER` defaults to `none`, and every new variable has a working default. Nothing about billing, proxies, capacity gating or error tracking activates until it is switched on deliberately.
- **`WEBHOOK_ALLOW_PRIVATE_TARGETS` defaults to `false`.** Alert webhooks are now refused against loopback, private, carrier-grade NAT, link-local and cloud metadata targets, at registration and again when the connection is made. If you deliver alerts to your own LAN from a self-hosted instance, set it to `true`. It refuses to boot alongside `BILLING_ENABLED=true`.

### Compatibility promise

From this release, the HTTP contract, the `@asobeast/shared` contract types and the MCP tool surface stay compatible throughout the `1.x` line. Breaking any of them requires `2.0.0`. Environment variables, the database schema and internal modules are outside that promise, and every schema change ships as a forward Prisma migration.
