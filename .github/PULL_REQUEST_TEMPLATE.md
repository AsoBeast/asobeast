## Summary

Describe what this pull request changes and why.

## How it was verified

Commands run and their outcome.

## Checklist

- [ ] Commits follow Conventional Commits (`type(scope): subject`, imperative, lowercase, max 72 characters)
- [ ] Branch name follows the conventional branch spec (`feat/`, `fix/`, `chore/`, ...)
- [ ] `pnpm lint`, `pnpm test` and `pnpm build` pass locally
- [ ] `pnpm --filter api test:e2e` and `pnpm --filter web test:e2e` pass when the change touches the API or the web app
- [ ] A `fix` includes a regression test observed failing for the reported symptom before the fix
- [ ] Nothing on the HTTP contract, the `@asobeast/shared` contract types or the MCP tool surface is removed, renamed or narrowed; those are compatible for all of `1.x`
- [ ] New behaviour is covered by unit tests; contract changes are covered by e2e tests
- [ ] No comments in changed code, no `any` outside the provider boundary
- [ ] Contract types live in `@asobeast/shared`; no Prisma type crosses the `apps/api` boundary
- [ ] No store network calls in tests
- [ ] `apps/api/.env.example`, `apps/web/.env.example` and `docs/configuration/reference.mdx` agree, or configuration did not change
- [ ] `pnpm docs:openapi` re-run, or no controller, DTO or response shape changed
- [ ] `pnpm docs:mcp-tools` re-run, or the tool catalog did not change
- [ ] Documentation updated (`README.md`, `AGENTS.md`) and in `/docs` when behaviour, configuration or the API surface changed
