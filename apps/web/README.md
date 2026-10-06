# asobeast web

The Next.js App Router frontend of asobeast. It reaches the NestJS API through the runtime proxy at `/api/backend/*`, which forwards to `API_INTERNAL_URL`, and types every response with `@asobeast/shared`.

## Develop

Set up the repository by following [CONTRIBUTING.md](../../CONTRIBUTING.md), then run the web app on its own from the repository root:

```bash
pnpm --filter web dev
```

It serves on port 3000 and expects the API at the address in `apps/web/.env`.

## Test

```bash
pnpm --filter web lint
pnpm --filter web test
pnpm --filter web test:e2e
```

The browser suite builds the app and serves it against a typed mock API on port 4100. Install its browsers once:

```bash
pnpm --filter web exec playwright install chromium webkit
```

## Learn more

The [development environment guide](https://docs.asobeast.com/install/local-development) covers the whole stack, and the [configuration reference](https://docs.asobeast.com/configuration/reference) lists every environment variable this app reads.
