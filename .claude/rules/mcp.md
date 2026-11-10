---
paths:
  - "packages/mcp-tools/**"
  - "apps/mcp/**"
  - "apps/api/src/mcp/**"
  - "apps/web/src/lib/mcp-*.ts"
---

# MCP rules

## Shared code rule 7: `@asobeast/mcp-tools` owns the tool catalog

- `MCP_TOOLS` (reads) and `MCP_WRITE_TOOLS` (writes) are the single definition of the MCP surface: name, title, description, `z.object` input schema and the wrapped route (a `GET` for a read; a method, path and JSON body for a write, with its destructive, idempotent and open world hints and the `outcome` an agent reads back).
- `toolsFor(scope)` decides what a connection lists, `requestOf` turns a tool into an HTTP request, `annotationsOf` produces its annotations; both transports call these and nothing else (`apps/mcp/src/tools/` for stdio, `apps/api/src/mcp/remote-tools.ts` for `POST /mcp`). `parity.test.ts` proves they have not drifted.
- The package depends on `@asobeast/shared` and `zod` only and never imports an MCP SDK package, because a bundled SDK type identity would tie the two transports together.

## Domain rule 10: Both MCP surfaces are mandatory-token surfaces, read-only unless the token is write scoped

- `apps/mcp` (stdio) sends `ASOBEAST_API_TOKEN` (`asob_…`) as a Bearer header on every request; its boot preflight (`/auth/me`) exits non-zero on a missing or invalid token or an unentitled instance and reads `tokenScope`. stdout belongs to JSON-RPC, so diagnostics go to stderr and the token is never logged.
- `POST /mcp` (`apps/api/src/mcp/`) takes the same token through `AuthGuard`, refuses a session cookie with 401, and dispatches each tool in process through `InProcessGateway.send` (method, URL, optional JSON body), so the inner route's guards, `StorableTextPipe`, `ValidationPipe`, write budget and quota run unchanged.
- Every tool in `MCP_TOOLS` is a `GET` annotated `readOnlyHint: true`; a write tool never joins that list. The eight `MCP_WRITE_TOOLS` (`track_keywords`, `untrack_keyword`, `add_competitor`, `remove_competitor`, `set_action_status`, `add_annotation`, `delete_annotation`, `inspect_keyword`) list only for a `write` scope token (`McpBridge.admit` attaches it as `req.auth`, the factory reads `authInfo`, stdio reads the preflight). The listing is a convenience; `TokenScopeGuard` on the inner route is the authority, so a read token naming a write tool still gets 403.
- A write tool wraps an existing route the web already uses, never a new one or parallel logic, declares honest hints (`destructiveHint` for a delete, `openWorldHint` for anything reaching a store) and returns a slim `outcome`. A failed write with status 0 or 5xx, or an unreadable 2xx, says the change may or may not have been applied.
- `POST /mcp` draws the plan's `mcpRequestsPerMinute` one unit per JSON-RPC message (`messageCountOf`): a batch of n costs n through one `INCRBY` and is refused whole with 429 when the window cannot cover it, or uncounted when n exceeds the whole budget; a single request costs one.
