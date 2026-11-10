---
paths:
  - "apps/api/src/admin-surfaces.ts"
  - "apps/api/src/main.ts"
  - "apps/api/src/auth/platform-operator.ts"
  - "apps/api/src/support/**"
  - "apps/api/src/metrics/**"
  - "apps/web/src/app/**/admin/**"
  - "apps/web/src/app/docs/**"
  - "apps/web/src/app/metrics/**"
  - "apps/web/src/components/admin/**"
  - "apps/web/src/lib/admin-*.ts"
  - "apps/web/src/proxy.ts"
---

# Admin surface rules

## Domain rule 11: The admin surfaces bypass Nest's guards, so they carry their own gate

The gate:

- Bull Board mounts its own Express router and `SwaggerModule.setup` registers on the Express adapter, so `AuthGuard` and `EntitlementGuard` never run for `/admin/queues` or `/docs*`. `configureAdminSurfaces`, called from `main.ts` before `app.listen` (module middleware registers during `app.init()`, so it lands first) and from the e2e app, resolves the cookie or `asob_` token itself and answers 404, never 401 or 403, unless the caller is an entitled platform operator.
- It keeps the token's scope: `/admin/queues` is the one write capable surface, so a read token gets 404 on any method but `GET`, `HEAD` and `OPTIONS` there. `/docs*` is gated only under `API_DOCS=owner` (default); `public` serves it to anyone and `off` never registers it. Bull Board re-asserts the grant through `requireAdminAccess`, so a missing wiring fails closed.
- A final gate on the `/admin` prefix (`ADMIN_AREA_SURFACE`) applies the same check to every other path below it, `/admin/capacity` and `/admin/proxy-pool` included, so a new operator controller is hidden without being listed. It requires no plan in force (`requiresPlan: false`). A controller under `admin/` still calls `requirePlatformOperator`.
- The gate resolves credentials through `CredentialResolver`, so a refused credential spends the per address rejection budget, and a spent budget still answers 404 here, never 429.
- Both surfaces are reachable only through the web origin, via route handlers at the identical path (`apps/web/src/app/admin/queues`, `/docs`, `/docs-json`, `/docs-yaml`), because both SPAs build asset URLs from their mount path. Each exports `POST`, `PUT`, `PATCH`, `DELETE` and `OPTIONS` from `lib/api/refused-methods.ts` (the not found envelope) unless it forwards the method, because Next.js answers an unexported method with 405 (or 204 with `Allow`), which confirms the route; a new hidden surface does the same.
- A new Swagger route variant joins `DOCS_ROUTES`, or the whole OpenAPI document is served to anonymous callers.
- `src/proxy.ts` exempts these surfaces from the sign in redirect so a token reaches the gate. Under `/admin` it exempts only `admin/queues`, so no admin page may be named `queues`.

The platform operator:

- `isPlatformOperator` (`apps/api/src/auth/platform-operator.ts`) is the only definition: the `owner` of the bootstrap workspace. Never `role === 'owner'` alone, because every hosted customer owns their own workspace.
- Every cross-tenant surface authorizes with it and answers 404 to a tenant owner: `configureAdminAccess` (queues, docs, metrics, support), `SupportController`, `SupportDirectoryController`, `MetricsController`, `CapacityController`, `ProxyPoolController`. A controller refuses through `requirePlatformOperator(user, notFound)`, never an inline check. The overview's optional `activation` block counts primary apps imported in the last `ACTIVATION_WINDOW_DAYS` that ranked within a day or completed setup.
- The web `/admin` layout gates with `viewerAdminAccess`: a non-operator gets the in shell not found page with HTTP 200 and a `noindex` robots tag (the stream has started when `notFound()` runs), and an operator without a plan in force gets a notice. The API refuses on its own regardless.
- `OwnerGuard` and the account deletion check stay plain workspace owner checks.
- `platform-operator.ts` and `auth.service.ts` are the only service files the `DEFAULT_WORKSPACE_ID` ESLint rule exempts. `isOperatorWorkspace` is the one check for the bootstrap workspace, which cannot be suspended (`WorkspaceSuspension.suspend` answers 409; `node dist/auth/abuse/workspace-suspension.cli.js restore ws_default` recovers an older instance).
- The operator workspace cannot be scheduled for deletion while any account exists outside it (409). `AccountDeletionService` checks again before claiming the row and inside the erasing transaction under the registration advisory lock (`auth/registration-lock.ts`), and cancels instead of erasing.
