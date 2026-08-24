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

## At 1.0.0, on 2026-08-24

Two advisories, one of them high, measured at the release commit. Neither is
reachable from untrusted input.

| Package   | Severity | Path                                                 | Why it is accepted                                                                                                                                                                                  |
| --------- | -------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nanoid`  | High     | `apps/web > @tailwindcss/postcss > postcss > nanoid` | The flaw is an infinite loop in `customAlphabet` and `customRandom` when the caller passes a size of `0`. Only the CSS build reaches it, with a size nobody supplies. No running code path calls it |
| `esbuild` | Low      | `apps/mcp > tsup > esbuild`                          | Path traversal in the esbuild development server, on Windows only. asobeast never runs that server, and the dependency is build time                                                                |

### Pins that keep the count at two

`deepmerge-ts` is pinned to `^8.0.2` in the root `pnpm.overrides`, which is the
one place this repository holds a transitive version a direct dependency cannot
yet deliver. `@prisma/config` still resolves below the patched range on its own,
so the pin stays until Prisma ships a release that carries it. Validate any
change to that block against `pnpm build`, `prisma validate` and a from-scratch
`prisma migrate deploy`.

No advisory sits in the runtime path. `@perttu/app-store-scraper` 2.1.0 carries
a patched `fast-xml-parser`, which is the only dependency that parses untrusted
input at all, and asobeast parses XML without ever building it.

### What was tried

Overriding `nanoid` to the patched `^3.3.18` was tried and reverted. The
resolution churn it caused pulled newer transitive versions across the tree and
raised the advisory count rather than lowering it. A fix that opens five holes
to close one is not a fix.

### What would change this

- `nanoid` closes on a `@tailwindcss/postcss` release carrying a patched `postcss`.
- `esbuild` closes on a `tsup` release carrying the patched version, which is a
  development dependency bump and needs no coordination.
- The `deepmerge-ts` override is dropped the moment `@prisma/config` resolves
  the patched range itself. Keeping an override past that point is its own risk.

## Held back on purpose

Three updates in the dependency groups are not applied, because each needs a
migration rather than a version number.

| Package                   | Held at   | Why                                                                                                                                                                                                                                                                            |
| ------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `typescript`              | `^5.9.3`  | Version 7 is the native compiler port. `tsup` cannot generate declarations against it: `packages/shared` fails its build with `Cannot read properties of undefined (reading 'useCaseSensitiveFileNames')`. Moving needs a declaration build that supports the new compiler API |
| `eslint` and `@eslint/js` | `^9.39.5` | Version 10 removed `context.getFilename`, which `eslint-plugin-react` 7.37.5 still calls. `eslint-config-next` pulls that plugin in, so linting the web app crashes. Moving needs an `eslint-plugin-react` release that supports ESLint 10                                     |
| `@tanstack/react-table`   | `^8.21.3` | Version 9 is a rewrite. Its legacy compatibility entry point still needs changes across three files and does not accept the column helper output without casts. It belongs in its own change                                                                                   |

None of the three carries an advisory. Track them and take them when the
toolchain catches up.
