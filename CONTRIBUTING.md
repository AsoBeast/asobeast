# Contributing to asobeast

Thank you for helping improve asobeast. The project is a self-hosted App Store Optimization toolkit built as a TypeScript monorepo.

## Prerequisites

- Node.js 22 or newer
- pnpm 10
- Docker with Docker Compose for PostgreSQL and Redis

## Local setup

```bash
git clone https://github.com/AsoBeast/asobeast.git
cd asobeast
pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

Generate unique values for `POSTGRES_PASSWORD` and `AUTH_SECRET`, then add them to the copied environment files. Do not reuse development secrets in a deployed instance.

```bash
docker compose -f docker-compose.dev.yml up -d
pnpm --filter api db:migrate
pnpm dev
```

## Verification commands

| Command                            | Purpose                                 |
| ---------------------------------- | --------------------------------------- |
| `pnpm lint`                        | Run lint checks across the monorepo     |
| `pnpm test`                        | Run unit tests across the monorepo      |
| `pnpm build`                       | Build every package and application     |
| `pnpm --filter api test:e2e`       | Run the API end-to-end suite            |
| `pnpm --filter api test:isolation` | Run the tenancy isolation suite         |
| `pnpm --filter web test:e2e`       | Run the browser end-to-end suite        |
| `pnpm test:cov`                    | Run unit tests with coverage floors     |
| `pnpm format:check`                | Check formatting without changing files |

## Contribution rules

- Use Conventional Commits in the form `type(scope): subject` so release automation can classify each change. The allowed types are `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`, and `revert`. The allowed scopes are `repo`, `api`, `web`, `mcp`, `shared`, `docker`, `ci`, `docs`, `deps`, `deps-dev`, `db`, `providers`, `apps`, `keywords`, `rankings`, `scoring`, `competitors`, `analytics`, `jobs`, `audit`, `metadata`, `changes`, `alerts`, `auth`, and `actions`. Use `docs` for the Mintlify documentation site in `/docs` and `repo` for repository-level documentation such as this file and the README.
- Use a conventional branch prefix followed by a kebab-case slug: `feat/`, `fix/`, `refactor/`, `test/`, `docs/`, `chore/`, `ci/`, `build/`, or `perf/`. Predictable names make branch intent visible before review.
- Do not write comments in code. Prefer clear names, small functions, and extracted abstractions that make the implementation explain itself.
- Keep TypeScript strict and do not use `any` outside the provider boundary. Untyped scraper payloads may enter under `apps/api/src/store-providers/` only and must be mapped to typed structures immediately.
- Put request and response contracts in `@asobeast/shared`. Prisma-generated types must never leave `apps/api`, which keeps consumers independent of the database implementation.
- Route every store request through `StoreProvider`. This isolates parser failures and keeps rate limiting consistent.
- Never make store network calls in tests. Mock providers in unit and end-to-end suites so tests remain deterministic and respectful of store limits.

### Regression tests for fixes

Every fix must include a test that fails before the correction and passes afterward. Write it from the reported symptom rather than the suspected cause, confirm that it fails for the reported reason, make the smallest correction, and run the complete relevant suite. Keep the test beside the behaviour it protects: a unit spec for logic, an API end-to-end spec for a contract or guard, or a Playwright spec for a user-visible flow.

### Coverage floors

`pnpm test:cov` measures coverage in `apps/api`, `apps/web` and `packages/shared`, and fails when it drops below the floor each package configures. Treat those numbers as a ratchet rather than a target.

- A floor is the coverage that was measured when it was set, minus a point of tolerance, and two points for branches. It is not an aspiration, and writing tests to reach a round number is not the goal.
- Raising a floor belongs in the pull request that raised the coverage. Do it in the same change, or the next contributor inherits the old number and the gain is given back.
- Lowering a floor requires a written justification in the pull request body. Deleting well-covered code is a legitimate reason. Tests being awkward to write is not.
- Untested code is not blocked from merging as long as the percentage holds. The floor prevents erosion; it does not mandate coverage of every line.
- Five paths in `apps/api` carry their own thresholds because a silent bug in them is expensive: the scoring formulas, the action rules, the alert flush, the entitlement check and data retention. Jest excludes a file with its own threshold from the global group, so the global floor covers everything else and is not subsidized by those modules.

## Documentation

The public documentation site lives in `/docs` and is built with Mintlify. It is not a pnpm workspace member and has no build step in this repository.

```bash
pnpm docs:dev     # local preview
pnpm docs:check   # mint validate, broken-links and a11y
pnpm docs:prose   # vale, install it with: brew install vale
pnpm docs:format  # Mintlify's canonical MDX formatter
```

Content rules: every page needs a `title` and a `description`, headings use sentence case, prose uses no dash punctuation, and every code block declares a language. Prettier does not format `docs/**/*.mdx`, so use `pnpm docs:format` instead.

Two changes travel with their code. A change that adds or alters an environment variable also updates `docs/configuration/reference.mdx` in the same commit. A change to a controller, a DTO or a response shape re-runs `pnpm docs:openapi`.

## Fixing a broken parser

A remote store layout change should be contained to one file under `apps/api/src/store-providers/`. Raw scraper payloads are retained in `raw` JSON columns, so reproduce the failure against stored real data, correct the mapping, and ship the fix with a unit test built from a recorded payload. Do not broaden the fix into unrelated provider or product work.

## Licensing of contributions

asobeast is licensed under [AGPL-3.0-only](LICENSE), declared as `AGPL-3.0-only` in every package manifest so that automated scanners read the same answer the repository gives.

**There is no contributor licence agreement, and there will not be one.** Opening a pull request licenses your contribution under AGPL-3.0-only, and nothing more is asked of you. No copyright is assigned, and no separate signature is collected.

This is a deliberate choice with a real cost, so the cost is written down rather than discovered later:

- The project cannot be relicensed, because no single party owns the whole copyright.
- A commercial exception cannot be offered to a customer whose legal team objects to the AGPL, for the same reason.
- Any hosted service built on this code, by the maintainers or by anyone else, is bound by the same network-service clause.

The last point is the reason for the choice. The clause that protects contributors from a closed fork of their work is the same clause that binds the maintainers, and a contributor agreement that exempted one party from it would make the licence a formality. Keeping every party under the same terms is what makes the licence mean something.

The hosted service is therefore charged for hosting, never for features. Self-hosted installations receive every feature the hosted service has.

## Roadmap and compatibility

The compatibility promise for the `1.x` line is the thing to check before you start: the HTTP contract, the `@asobeast/shared` contract types and the MCP tool surface stay compatible throughout `1.x`. Adding an endpoint, an optional field or a tool is fine. Removing or renaming anything on those three surfaces, or narrowing what a request accepts or a response guarantees, needs `2.0.0` and will not be merged into `1.x`. Environment variables, the database schema and internal modules sit outside the promise, and schema changes always ship as forward Prisma migrations.

Open a feature request issue before a large `feat` so the design is agreed before you write it.

Use one branch and one pull request per change, with each commit a single logical step.

## Versions and changelog

Release Please owns package versions and `CHANGELOG.md`. Never bump a version or edit the changelog by hand. If the release pipeline ever wedges, `docs/operations/release-recovery.mdx` records how to recover it.

A release ships when the generated release pull request is merged. Mark a breaking change with `feat!` or a `BREAKING CHANGE:` commit footer so Release Please includes it in the generated changelog and computes the correct version. Only a commit subject and a breaking-change footer reach the changelog, so anything an operator must read before upgrading belongs in one of those, never in a plain commit body.

Dependabot monitors the application Dockerfiles. It does not monitor the PostgreSQL and Redis base images in the Compose files, nor the `overrides` block in `pnpm-workspace.yaml`, so review those manually before each release.

Container images are built only from a published release, never from `main`.
