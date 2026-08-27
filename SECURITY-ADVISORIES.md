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

Three updates are not applied, because each needs a migration rather than a
version number.

| Package                   | Held at   | Why                                                                                                                                                                                                                                                                            |
| ------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `typescript`              | `^5.9.3`  | Version 7 is the native compiler port. `tsup` cannot generate declarations against it: `packages/shared` fails its build with `Cannot read properties of undefined (reading 'useCaseSensitiveFileNames')`. Moving needs a declaration build that supports the new compiler API |
| `eslint` and `@eslint/js` | `^9.39.5` | Version 10 removed `context.getFilename`, which `eslint-plugin-react` 7.37.5 still calls. `eslint-config-next` pulls that plugin in, so linting the web app crashes. Moving needs an `eslint-plugin-react` release that supports ESLint 10                                     |
| `stripe`                  | `22.5.0`  | 22.6.0 moves the pinned API version to `2026-08-26.dahlia`, which the SDK types enforce. The recorded webhook envelopes under `test/fixtures/stripe` are captured at `2026-07-29.dahlia`, so the version cannot move until they are recaptured against the newer one           |

None of the three carries an advisory. Track them and take them when the
toolchain catches up.

`@tanstack/react-table` was held here until 1.1.0 and now runs on `^9.2.3`.
