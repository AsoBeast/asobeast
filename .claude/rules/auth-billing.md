---
paths:
  - "apps/api/src/auth/**"
  - "apps/api/src/billing/**"
  - "apps/api/src/account/**"
  - "apps/web/src/app/**/{login,register,verify,invite,forgot-password,reset-password,confirm-email,upgrade}/**"
  - "apps/web/src/components/{auth,billing}/**"
  - "apps/web/src/lib/{plan-choice,order-summary,paywall-faq,sign-up-steps,auth-routes,embedded-checkout,checkout-return,checkout-brand}*.ts"
---

# Authentication, registration and billing rules

## Domain rule 9: Authentication is mandatory, and self registration never joins a workspace that already holds data

Authentication and workspaces:

- `AuthGuard` (session cookie or `asob_` Bearer token) authenticates every request, then `EntitlementGuard` authorizes it; `@Public()` is the only bypass.
- `AUTH_REGISTRATION_WORKSPACE` decides where a registration lands and defaults to `own` in every mode: only the bootstrap owner joins `ws_default`, every later account owns its own workspace, which is what makes open registration safe under RLS. `shared` puts every sign up into `ws_default` as a `member`, an explicit opt-in for trusted sign ups, and refuses to boot with `BILLING_ENABLED=true`. Teammates join through the invite flow (`workspace-team.service.ts`), never self registration; never tie the workspace decision to `BILLING_ENABLED`.
- Registration runs under a `pg_advisory_xact_lock` and creates the workspace and the user in one transaction, so concurrent first registrations cannot both bootstrap and a duplicate email leaves no orphan workspace.
- `BILLING_ENABLED` is the premium seam: an unentitled request gets 402. Plan and entitlement live on `Workspace` (`plan`, `trialEndsAt`, `planExpiresAt`, `billingCustomerId`, `subscriptionId`), never on `User`. Account and paywall routes carry `@AllowUnentitled()`; an unentitled workspace keeps every session read and export, while every write, on demand action and `asob_` token request answers 402.

Credentials and sessions:

- `CredentialRateLimiter` (120 a minute per address, recorded by `CredentialResolver` for `AuthGuard` and the admin gate) counts only a credential that was looked up and refused. An accepted credential is never counted or refused by address, and a request with no client address (an in process MCP dispatch) is never counted. A cookie that fails `AuthService.verifySession` (another secret, expired, no `jti`) and an `Authorization` header without an `asob_` token (`apiToken`) answer 401 uncounted, so an `AUTH_SECRET` rotation sends browsers to sign in, not to a 429; a signed cookie whose session row is gone or stale is counted. Never gate an accepted credential on a bucket clients share.
- Every session cookie names a `Session` row by its `jti`. `Session` is an operator table (`OPERATOR_TABLES`, `operator_only` policy, cascades from `User`) read and written only in `CrossTenantAccess`; `AuthService.userOfSession` accepts a cookie only while `SessionStore.find` returns an unexpired row of that user with a matching `sessionVersion`. `POST /auth/logout` ends only the caller's row (`AuthService.endSession`); retention removes expired rows.
- Changing or recovering a password bumps `sessionVersion` and deletes every `Session` row and `ApiToken` of the user in one transaction (`endSessions`, `revokeApiTokens`), because `resolveToken` never reads `sessionVersion`.
- A route that manages credentials, team membership or workspace deletion carries `@SessionOnly()`, enforced by `TokenScopeGuard` from `req.credential`: token create and revoke, password change, deletion schedule and cancel, invite create and revoke, member removal, and posting or withdrawing a review reply answer 403 to every `asob_` token, write scope included. The `token-scope` e2e fails if an MCP write tool wraps one.
- `POST /workspace/invites` returns the token in `acceptPath` (`acceptPathFor`, `auth/invite-link.ts`) only when the instance cannot email or registration is closed and the send did not succeed; otherwise `acceptPath` is the bare `INVITE_PATH`. An owner holding the token could accept a stranger's invitation and later inherit their account through password recovery.

Trial:

- A mailbox gets one trial, ever. `mailboxOf` (`auth/mailbox-key.ts`) lowercases, drops a `+tag` on every domain, and for Gmail drops dots and folds `googlemail.com`, on top of `canonicalAddress` (`auth/canonical-address.ts`: NFKC, quotes and the trailing domain dot removed, unicode domains in ASCII), which `isDisposableEmail` shares. `TrialClaims` stores an HMAC of it under `AUTH_SECRET` as a `TrialClaim` row, an operator table with no workspace and no foreign key, so it outlives an erased workspace and holds no address. Rotating `AUTH_SECRET` forgets every claim.
- A claimed mailbox or a `mailchecker` disposable domain still registers and signs in but gets no trial offer: a warning names the address, `Workspace.trialDeclinedAt` records it (written only by `EmailVerificationService.writeTerms`), `canStartTrial` reads it, `trialAwaitsCheckout` is `false`.
- The hosted trial is a Stripe subscription in `trialing`, started by Checkout on a verified card: `subscription_data.trial_period_days` from `TRIAL_DAYS`, `payment_method_collection: 'always'`, `missing_payment_method: 'cancel'`. Nothing else stamps a trial (`grantTrial` is gone).
- `TrialOffers` (`auth/trial-offers.ts`) is the only reader of `trialOfferFor` (`canStartTrial`, an unclaimed mailbox, an owner; never the address confirmation) and reads the claim through `CrossTenantAccess`. `BillingService.checkout`, `GET /auth/plan` (`trialOffer`) and `GET /auth/me` (`trialAwaitsCheckout`) all use it.
- `TrialStarts.settle` settles the claims once per trial, from the webhook after every projection and the reconciler after every attempt, on `Workspace.trialClaimedAt` under a per workspace advisory lock: the owner's mailbox, and the card fingerprint (`trial-claim:card:` prefix) when the method is a `card` (a `link` claims nothing; Radar's free trial abuse control covers it). A lost claim calls `StripeService.cancelRefusedTrial` (no invoice) before the marker is written, never a release, and `markRefused` in the same transaction leaves no trial and no subscription, sets `trialDeclinedAt` and stores the id in `Workspace.trialRefusedSubscriptionId`; `isRefusedTrial` and `notRefusedTrial` keep that subscription's later events off the row. `GET /auth/plan` answers optional `trialRefused` until a plan is held; `TrialNotifier` sends one refusal email.
- The projection writes `trialStartedAt` and `trialEndsAt` from Stripe's `trial_start` and `trial_end`. `trialStartedAt` never changes once set except when a refusal clears it, and a subscription that stopped entitling never keeps a future `trialEndsAt`, so a cancelled card trial never revives through the legacy `trial` plan.
- `FirstPayment.record` writes `firstPaidAt` from the latest invoice when paid above zero, before the webhook's ordering guard. `effectOf(status, everPaid)` answers `recoverable` for a never paid `past_due`, reported by `AccountPlan.trialChargeFailed`; `active` at trial end is not a paid signal. `billingInterval` is written from the catalog for an entitling status. `planScopeOf` (with `subscriptionStatus` a required input) answers `trialingLimits` while `trialing` on a paid plan: that plan's limits with `TRIAL_AI_CALLS_PER_MONTH`.
- `TrialClaimBackfill` claims existing trial owners at boot through `registerInBackground`. Only `BILLING_ENABLED` runs any of this, and the operator workspace is not exempt.

Entry steps and the wall:

- `GET /auth/me` answers `entryStep` from `entryStepOf` (`auth/entry-step.ts`): `confirm-email` for an owner with an unconfirmed address where confirmation mail is sent, `choose-plan` for an owner whose workspace never held a subscription, trial or paid period (`heldPlanOf`), absent otherwise (members, lapsed workspaces, self hosted). The web routes an account to its step from `(app)/layout.tsx`, `AuthGate`, `/upgrade` and `/confirm-email` (`entryDestination`, `lib/auth-routes.ts`), standing down on a checkout return until the reconcile refreshed the account; `POST /billing/checkout` answers 403 during `confirm-email`, so register, confirm, pay, dashboard holds on the server.
- `/upgrade` is payment left, plans right, in the `(wall)` layout around Stripe's embedded Checkout (`STRIPE_PUBLISHABLE_KEY`) or the hosted redirect. Every session carries `branding_settings` from `CHECKOUT_BRAND[theme]`, the `--card` surface of the requested `theme` so the iframe matches the payment panel (`checkout-brand.test.ts` holds it to the tokens) and `locale: 'en'`; the web remounts the iframe with a new session on a theme change. `signUpSteps` (`lib/sign-up-steps.ts`) turns `entryStep` and `emailVerified` into the three steps shown above the heading, nothing when no step is owed. Never build Checkout Elements or offer a choice of payment methods: Managed Payments allows neither. `trialAwaitsConfirmation` and `trialAwaitsCheckout` stay informational.

Deletion and terms:

- A deletion request stops the renewal of a `trialing`, `active` or `past_due` subscription (`AccountDeletionService.stopRenewal`, releasing a schedule first and recording `Workspace.deletionStoppedSubscriptionId` only when it stopped it); cancelling the deletion restores it.
- Terms acceptance is `User.termsAcceptedAt` and `termsVersion` (`auth/terms-acceptance.ts`), written at registration and invite acceptance on a billing instance; bump `TERMS_VERSION` when asobeast.com/terms changes.
- `normalizeEmail` and the stored login email never change; the mailbox is only the trial key and the confirmation mail recipient key (domain rule 19).
