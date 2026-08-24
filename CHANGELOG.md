# Changelog

All notable changes to asobeast are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

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
