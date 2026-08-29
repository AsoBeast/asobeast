<div align="center">
  <img src="docs/images/logo-mark.png" alt="asobeast" width="112" />
  <h1>asobeast</h1>
  <p><strong>The open source, self-hosted App Store Optimization toolkit.</strong></p>
  <p>
    <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" /></a>
    <a href="https://github.com/AsoBeast/asobeast/releases"><img alt="Release" src="https://img.shields.io/github/v/release/AsoBeast/asobeast" /></a>
    <a href="https://docs.asobeast.com"><img alt="Documentation" src="https://img.shields.io/badge/docs-docs.asobeast.com-orange" /></a>
    <img alt="Stores" src="https://img.shields.io/badge/stores-App%20Store%20%2B%20Google%20Play-lightgrey" />
  </p>
  <p>
    <a href="https://docs.asobeast.com/quickstart"><strong>Quickstart</strong></a> ·
    <a href="https://docs.asobeast.com/install/docker-compose"><strong>Self-host</strong></a> ·
    <a href="https://docs.asobeast.com/mcp/introduction"><strong>MCP server</strong></a> ·
    <a href="https://docs.asobeast.com/api-reference/introduction"><strong>API</strong></a> ·
    <a href="CHANGELOG.md"><strong>Changelog</strong></a>
  </p>
</div>

## What is asobeast?

asobeast is a free, open source App Store Optimization (ASO) toolkit that you run on your own server. It imports an Apple App Store or Google Play listing, tracks keyword rankings daily to a depth of 200, watches competitors, reviews and metadata, and turns that history into a prioritized queue of ASO work.

Every store request runs on the machine hosting asobeast. There is no ASO vendor to sign up with, no API key to buy, and no third party that learns which keywords you target. Your data stays in your deployment unless you explicitly enable an outbound integration such as webhook alerts, email, store status updates or OpenAI assistance.

## Why asobeast?

- **No accounts, no vendor API keys.** asobeast collects from the public store endpoints at a deliberately modest rate. You need Docker and nothing else.
- **Your keyword list is your strategy.** It never leaves your database, so no competitor intelligence product is quietly assembling it.
- **Both stores as one tracking entity.** One app row tracks keywords across many storefronts, so `us` and `de` are markets on the same listing rather than two subscriptions.
- **Every score shows its evidence.** Traffic and difficulty carry their source, calculation version, capture date and confidence, so you can argue with a number instead of trusting it.
- **Deterministic recommendations.** Eight rules turn stored history into an explainable work queue. AI is optional garnish that can summarize an action, never invent or reorder one.
- **AGPL-3.0, no open core.** Every feature the hosted service runs is in this repository.

## Features

| Feature                          | What it does                                                                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two live stores                  | Import an Apple App Store or Google Play URL, snapshot the metadata, refresh on demand and diff every field                                        |
| Keyword tracking                 | Track any validated storefront, see daily positions and history, bulk edit, and keep the private 100 character iOS keyword field by hand           |
| Rank checks to depth 200         | One search per keyword and market serves your app and all of its competitors, so competitor tracking costs no extra requests                       |
| Transparent scoring              | Traffic and difficulty with provenance and confidence, plus per app opportunity derived on read                                                    |
| SERP and category intelligence   | Retained SERP snapshots, volatility, entrants and movers, and free, paid and grossing category charts                                              |
| Competitor discovery             | Find competitors from live search results, compare listings and find keyword gaps                                                                  |
| Reviews and change detection     | Sync reviews and rating history, mine review language for keyword ideas, and detect owned and competitor metadata changes                          |
| ASO audit and metadata workbench | A deterministic audit rubric with history, store metadata lints and strategic keyword buckets                                                      |
| ASO Action Center                | Eight deterministic rules produce recommendations with a priority, an estimated impact, the evidence behind them, a deep link and a full lifecycle |
| Portfolio analysis               | Group linked listings across stores and countries, compare group visibility and generate weekly digests                                            |
| Alerts                           | Signed webhooks or SMTP email for rank, SERP, metadata, review and new action events, with resumable batched delivery                              |
| MCP server                       | 21 read-only tools over stdio or a remote endpoint, so Claude Code and Claude Desktop can query your instance directly                             |

A guide for each of these lives in the [documentation](https://docs.asobeast.com).

## Quick start

You need [Docker](https://docs.docker.com/get-docker/) with Compose, roughly 2 GB of memory and 5 GB of disk.

```bash
git clone https://github.com/AsoBeast/asobeast.git
cd asobeast
printf 'POSTGRES_PASSWORD=%s\nAUTH_SECRET=%s\n' "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env
chmod 600 .env
docker compose up --build -d --wait
```

Open http://localhost:3001 and create the owner account. Registration closes automatically once it exists. Import a store URL and keyword tracking starts immediately.

Prefer published images to a build? `docker-compose.pull.yml` runs the same stack from GHCR without a clone:

```bash
curl -fsSLO https://raw.githubusercontent.com/AsoBeast/asobeast/main/docker-compose.pull.yml
printf 'POSTGRES_PASSWORD=%s\nAUTH_SECRET=%s\n' "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env
chmod 600 .env
docker compose -f docker-compose.pull.yml up -d --wait
```

Full walkthrough: [quickstart](https://docs.asobeast.com/quickstart). Image tags, pinning and upgrades: [run a published release](https://docs.asobeast.com/install/published-images).

## How asobeast compares

|                            | asobeast (self-hosted)            | Subscription ASO platforms       |
| -------------------------- | --------------------------------- | -------------------------------- |
| Where store requests run   | Your machine                      | Their infrastructure             |
| Who sees your keyword list | You                               | The vendor                       |
| Cost model                 | Your hosting bill                 | Per seat, per app or per keyword |
| Keyword history            | Yours, retained on your terms     | Ends when the subscription does  |
| Score methodology          | Published, versioned, inspectable | Usually proprietary              |
| Extending it               | Fork it, it is AGPL-3.0           | File a feature request           |

A hosted asobeast is a separate product built from this same repository. Self-hosted installations get every feature.

## Tech stack

pnpm and Turborepo, TypeScript strict throughout, NestJS, Prisma, PostgreSQL 18, BullMQ, Redis 8, Next.js with Tailwind, Docker Compose.

Contributor setup, architecture and the module map: [local development](https://docs.asobeast.com/install/local-development) and [how asobeast works](https://docs.asobeast.com/concepts/architecture).

## Configuration

Every environment variable, with defaults and what each one changes, is documented in the [configuration reference](https://docs.asobeast.com/configuration/reference). `apps/api/.env.example` and `apps/web/.env.example` are the authoritative lists in the repository.

A default installation needs two variables, `POSTGRES_PASSWORD` and `AUTH_SECRET`. Everything else has a working default.

## FAQ

### What is App Store Optimization?

App Store Optimization is the practice of improving how an app ranks and converts in App Store and Google Play search. It covers keyword targeting in indexed metadata fields, competitor positioning, ratings and reviews, and category performance.

### Does asobeast need an App Store Connect or Google Play Console account?

No. asobeast reads public store data, so you can track any app including your competitors. It never asks for store credentials or an ASO vendor API key.

### Which app stores does asobeast support?

Both the Apple App Store and Google Play. Apple indexes a title, a subtitle and a private 100 character keyword field. Google Play indexes a title, an 80 character short description and a long description, so subtitle and keyword field stay Apple only concepts. See [stores](https://docs.asobeast.com/concepts/stores).

### How often does it check rankings?

Once a day by default, on a UTC cron you control. Rank checks capture position to a depth of 200, and a position of `null` means checked and not found within that depth rather than zero. See [positions](https://docs.asobeast.com/concepts/positions).

### Can I track more than one country?

Yes. An app is imported once, and keyword tracking carries its own storefront, so one listing can track keywords in many markets at once. Each added market multiplies daily store requests, and the settings page shows a budget card that estimates the fan-out. See [countries and markets](https://docs.asobeast.com/concepts/countries).

### Is any of my data sent anywhere?

No, unless you turn it on. Webhook alerts, SMTP email and OpenAI assistance are the only outbound paths, and each is off until configured. There is no telemetry.

### Can I connect asobeast to Claude or another AI agent?

Yes. asobeast ships a Model Context Protocol server with 21 read-only tools, available as a local stdio process or as a remote endpoint on your instance. Every tool is a `GET` and requires a personal API token. See [MCP](https://docs.asobeast.com/mcp/introduction).

### Is asobeast really free?

The software is, entirely. It is AGPL-3.0 with no open core and no feature held back for a commercial edition, so a self-hosted installation has everything. A hosted service built from this same repository is charged for the hosting it uses, never for features. If you run a modified version as a network service, the AGPL asks you to offer that modified source to its users.

## Documentation

| Topic                                   | Link                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| Quickstart and first import             | [docs.asobeast.com/quickstart](https://docs.asobeast.com/quickstart)         |
| Self-hosting with Docker Compose        | [install/docker-compose](https://docs.asobeast.com/install/docker-compose)   |
| Configuration reference                 | [configuration/reference](https://docs.asobeast.com/configuration/reference) |
| Concepts: scoring, positions, countries | [concepts](https://docs.asobeast.com/concepts/architecture)                  |
| Guides: keywords, competitors, alerts   | [guides](https://docs.asobeast.com/guides/track-keywords)                    |
| Operations: backups, restore, upgrades  | [operations](https://docs.asobeast.com/operations/backups)                   |
| API reference and OpenAPI               | [api-reference](https://docs.asobeast.com/api-reference/introduction)        |
| MCP tools                               | [mcp/tools](https://docs.asobeast.com/mcp/tools)                             |

## Limitations

Worth knowing before you rely on it:

- **Scores are store-specific estimates.** Traffic and difficulty come from different public evidence on each store, so the numbers are not comparable across stores and are not a substitute for first-party acquisition data.
- **Scrapers can break.** asobeast reads public endpoints. When a store changes one, a parser can fail. Failures fail the job, which BullMQ retries with backoff, and never take down request handling.
- **Store rate limits bind first, not hardware.** The public endpoints tolerate only modest request rates per address, which is what caps how many keyword markets one instance can track. See [capacity and limits](https://docs.asobeast.com/operations/capacity).
- **Operations are yours.** Backups, TLS, secret rotation, monitoring and upgrades are the operator's responsibility. Verify a restore before you rely on a backup.

## Roadmap

`1.0.0` is the current release. What remains open:

- A per-user permission model finer than owner and member, and one account in several workspaces.
- Better traffic calibration using licensed or first-party acquisition data.
- A per-market app detail switcher, so snapshots, reviews and category ranks are not limited to the home storefront.
- Write capable MCP tools, behind an explicit opt-in. Every tool is read-only today on purpose.

Release policy and the `1.x` compatibility promise: [upgrade and roll back](https://docs.asobeast.com/install/upgrade).

## Contributing

Pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first for the commit conventions, the compatibility promise and how the test suites are run. Security reports go through [SECURITY.md](SECURITY.md), never a public issue.

## License

Copyright (C) 2026 the asobeast contributors.

[AGPL-3.0-only](LICENSE), declared in every package manifest. Contributions are accepted under the same licence with no contributor licence agreement. See [licensing of contributions](CONTRIBUTING.md#licensing-of-contributions).
