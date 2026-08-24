# asobeast documentation

Source for `https://docs.asobeast.com`, built with Mintlify.

## Local preview

From the repository root:

```bash
pnpm docs:dev
```

## Checks

```bash
pnpm docs:check
```

Runs `mint validate`, `mint broken-links` and `mint a11y`, three of the four checks the docs workflow runs on every pull request.

The fourth is Vale, which lints prose against the rules in `styles/asobeast`:

```bash
pnpm docs:prose
```

Vale is not a repository dependency. Install it with `brew install vale` on macOS, or download a release from `https://github.com/vale-cli/vale/releases`. The workflow downloads a pinned version and is the authoritative run.

## Refresh the OpenAPI capture

`api-reference/openapi.json` is a committed artefact. Re capture it whenever an endpoint, a DTO or a response shape changes.

```bash
docker compose -f docker-compose.dev.yml up -d
pnpm --filter api dev
ASOBEAST_API_TOKEN=asob_... pnpm docs:openapi
```

Without a token, start the API with `API_DOCS=public` in `apps/api/.env` and drop the environment variable.

## Conventions

Content rules live in `CONTRIBUTING.md`. Every page needs a `title` and a `description`. Headings use sentence case. Prose uses no dash punctuation.

## Deployment

The Mintlify GitHub App deploys `main` automatically. There is no build step in this repository.
