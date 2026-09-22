# Open dependency advisories

`pnpm audit` reports advisories against the whole dependency tree, including the
build toolchain. This file records every advisory open at the release commit,
what reaches it, and why it is or is not exploitable in asobeast.

Regenerate the list before every release and update this file with it.

```bash
pnpm audit
```

An advisory belongs here only when it cannot be fixed by an upgrade. Anything a
version bump closes gets bumped instead, and never recorded as accepted.

## At 1.2.0, on 2026-09-12

None. `pnpm audit` reports no known vulnerabilities.

Twelve advisories were open across five packages before this release, and
every one closed by raising a floor rather than by accepting it. None sat in
a direct dependency, so none could be bumped in a manifest:

| Package  | Reached through            | Raised to        |
| -------- | -------------------------- | ---------------- |
| `multer` | `@nestjs/platform-express` | `>=2.3.0 <3`     |
| `qs`     | `express`                  | `>=6.16.0 <7`    |
| `mysql2` | `prisma`                   | `>=3.23.1 <4`    |
| `hono`   | the MCP SDK                | `>=4.13.5 <5`    |
| `sharp`  | `next`                     | `>=0.35.4 <0.36` |

Every floor carries an upper bound, for the reason the 1.1.0 entry below
records: an open-ended floor takes whatever exists the next time the lockfile
resolves, not the version that was tested.

## At 1.1.0, on 2026-08-27

None. `pnpm audit` reports no known vulnerabilities.

Both advisories accepted at 1.0.0 are closed, and neither needed a direct
dependency to move:

| Package   | Was  | Closed by                                                            |
| --------- | ---- | -------------------------------------------------------------------- |
| `nanoid`  | High | `nanoid: ">=3.3.18 <4"`, which `postcss` accepts under its `^3.3.16` |
| `esbuild` | Low  | `esbuild: ">=0.28.1 <0.29"`, one minor above what `tsup` asks for    |

Both carry an upper bound, and both need one. An override replaces the range its
consumer asked for, so an open-ended floor takes the newest release in existence
the next time the lockfile is resolved, not the version that was tested. Left
unbounded, `nanoid: ">=3.3.18"` resolves to 6.0.1, which is ESM only, while
`postcss` loads `nanoid/non-secure` through `require`: that breaks the CSS build
on whichever later change regenerates the lockfile, not on the one that
introduced it. `esbuild` is pre-1.0, where a minor may break, and `tsup` asks for
`^0.27.0`. Keep any override that crosses what its consumer declared inside a
range that has been built.

### Why the overrides work now

Both floors were expressible before and still did nothing, because every
override in `pnpm-workspace.yaml` was dead config. pnpm reads `pnpm.overrides`
from the root `package.json` when that field exists and ignores the workspace
file entirely, so the lockfile only ever carried `deepmerge-ts`. `fast-uri`,
`hono`, `js-yaml` and the two `next` floors were declared and never applied:
`fast-uri` sat at 3.1.5 against a `>=4.1.2` floor, and `js-yaml` resolved to
3.15.1, 4.3.1 and 5.3.0 at once against a `>=5.2.2` floor.

Every override now lives in `pnpm-workspace.yaml` and the root `package.json`
carries no `pnpm` field, so the lockfile carries all eight. Keep them in one
file. Splitting them again silently disables whichever set loses.

Activating the floors that had never applied moved `fast-uri` to 4.1.3 and
collapsed `js-yaml` onto 5.3.0. Both were verified against the full suite rather
than assumed, and `esbuild` 0.28.2 builds `packages/shared`, `packages/mcp-tools`
and `apps/mcp` through `tsup` unchanged.

`deepmerge-ts` stays pinned to `^8.0.2` for the reason it always was:
`@prisma/config` still resolves below the patched range on its own. Drop the pin
once Prisma ships a release that carries it, and validate any change to that
block against `pnpm build`, `prisma validate` and a from-scratch
`prisma migrate deploy`.

No advisory sits in the runtime path. `@perttu/app-store-scraper` 2.1.0 carries
a patched `fast-xml-parser`, which is the only dependency that parses untrusted
input at all, and asobeast parses XML without ever building it.

### What was tried before

Overriding `nanoid` alone was tried at 1.0.0 and reverted for raising the
advisory count rather than lowering it. That attempt predates the consolidation
above. With one override file the same floor closes the advisory and `pnpm audit`
comes back empty.

## Held back on purpose

Five updates are not applied, because each needs a migration rather than a
version number, or has no released version that fits.

| Package                   | Held at   | Why                                                                                                                                                                                                                                                                            |
| ------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `typescript`              | `^5.9.3`  | Version 7 is the native compiler port. `tsup` cannot generate declarations against it: `packages/shared` fails its build with `Cannot read properties of undefined (reading 'useCaseSensitiveFileNames')`. Moving needs a declaration build that supports the new compiler API |
| `eslint` and `@eslint/js` | `^9.39.5` | Version 10 removed `context.getFilename`, which `eslint-plugin-react` 7.37.5 still calls. `eslint-config-next` pulls that plugin in, so linting the web app crashes. Moving needs an `eslint-plugin-react` release that supports ESLint 10                                     |
| `@nestjs/*`               | `^11.2.1` | Nest 12 publishes as pure ESM: `@nestjs/common` declares `"type": "module"` and its `exports` carry no `require` condition, so the commonjs api cannot load it and every jest suite fails to parse it. `@nestjs/throttler` has no release that accepts nest 12 at all          |
| `@nestjs/config`          | `^4.0.4`  | Version 12 accepts nest 11 in its peer range but is itself pure ESM, so it cannot be loaded either. It also moves validation to Standard Schema and reorders how internal config, validated env and `process.env` take precedence                                              |
| `prisma`                  | `^7.10.0` | The `latest` dist-tag is `8.0.0-rc.13`, a release candidate. `prev` is `7.10.0`                                                                                                                                                                                                |

None of the five carries an advisory. Track them and take them when the
toolchain catches up.

`typescript` is held for a second reason now: `ts-jest` 29 declares
`typescript: ">=4.3 <7"` and `typescript-eslint` 8.70 declares
`>=4.8.4 <6.1.0`, so the whole api test run and every type-aware lint rule
refuse version 7 outright.

The nest hold is the one to watch. It is not only the ESM packaging: nothing
can move until `@nestjs/throttler` ships a release that accepts nest 12, and
6.5.0 is still the latest. Moving after that still needs the api to become an
ESM package, which is a migration of its own rather than a version bump.

Prisma is held on a dist-tag rather than a range. Its `latest` tag points at
`8.0.0-rc.13` while `prev` points at `7.10.0`, so anything resolving "the
newest prisma" installs a release candidate. Pin the version until 8.0.0 is
final.

`@tanstack/react-table` was held here until 1.1.0 and now runs on `^9.2.3`.
