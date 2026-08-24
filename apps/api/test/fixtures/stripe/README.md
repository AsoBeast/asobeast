# Stripe webhook fixtures

Full event envelopes for API version `2026-07-29.dahlia`, the version
`apps/api/src/billing/stripe.client.ts` pins. Each file is one complete
`Stripe.Event` exactly as the endpoint receives it, so the e2e suite exercises
the same shape the live integration does, including the `data.object` nesting
and `data.previous_attributes`.

The identifiers are test-mode placeholders (`sub_Test…`, `cus_Test…`,
`price_Test…`). The e2e suite signs each payload with
`stripe.webhooks.generateTestHeaderString` and a known test secret, so signature
verification is genuinely exercised rather than stubbed.

These envelopes were assembled from the pinned SDK's own resource types rather
than captured from a live `stripe listen` session, because the repository has no
Stripe account to capture against. Recapture them with the Stripe CLI before the
first production launch:

```bash
stripe listen --forward-to localhost:4000/billing/webhook --print-json
```

When the pinned API version changes, recapture rather than hand-edit.
