# Stripe webhook fixtures

Full event envelopes for API version `2026-08-26.dahlia`, the version
`apps/api/src/billing/stripe.client.ts` pins. Each file is one complete
`Stripe.Event` exactly as the endpoint receives it, so the e2e suite exercises
the same shape the live integration does, including the `data.object` nesting
and `data.previous_attributes`. There is one file per event type in
`HANDLED_EVENTS`, plus `customer.subscription.cancel_pending` and
`customer.subscription.past_due` as named variants of `updated`, and
`customer.discount.created` as the unhandled type.

The e2e suite signs each payload with `stripe.webhooks.generateTestHeaderString`
and a known test secret, so signature verification is genuinely exercised rather
than stubbed. It also fails when a fixture leaves the pinned version, carries
`livemode: true` or holds an identifier outside the `_Test` family.

## Provenance

The envelopes were assembled from the pinned SDK's resource types. On
2026-09-22 they were compared field by field with the events a Stripe sandbox
had retained from real checkouts and renewals. That comparison removed the
top-level `subscription` from both invoice envelopes: an invoice on a `dahlia`
API version names its subscription only through
`parent.subscription_details.subscription`, and the old field hid whether the
handler reads it there. The retained events are on `2026-07-29.dahlia` and
Stripe renders an event in the version it was created with, so they cannot
replace these files.

On 2026-09-23 the manual pass forwarded real `2026-08-26.dahlia` events from
checkouts, test clock renewals, a scheduled downgrade, a cancellation and CLI
triggers, and every field path each envelope here carries was checked against
them. None was missing from the real events, and the subscription invoices again
named their subscription only through `parent.subscription_details`. The files
stay assembled, because the e2e suite addresses them by their identifiers.

## Capturing

Recapture on the pinned version from the `asobeast-local` sandbox, never from a
sandbox another stack uses. With the stack running and the catalog provisioned:

```bash
stripe listen --project-name asobeast-local --latest --all-snapshot --forward-to localhost:4000/billing/webhook --format json > raw/events.jsonl
```

`--latest` renders the events on the newest API version instead of the
account's default, so check that the line `stripe listen` prints when it is
ready names the pinned version. Run M-QA-01, M-QA-03, M-QA-04, M-QA-06 and
M-QA-07 from the manual pass, then `stripe trigger`
`customer.subscription.trial_will_end` and `customer.subscription.paused` for
two events no asobeast flow produces. The CLI cannot trigger
`customer.subscription.resumed`, so resume the paused subscription with
`stripe post /v1/subscriptions/<id>/resume`. Pick one envelope per file name above, save
each as `raw/<name>.json`, and scrub it:

```bash
node apps/api/test/fixtures/stripe/scrub.mjs < raw/invoice.paid.json > apps/api/test/fixtures/stripe/invoice.paid.json
```

`scrub.mjs` refuses a live event, maps the first customer to
`cus_TestWorkspace1`, the first subscription to `sub_TestIndieMonthly` and each
catalog price to the id its lookup key names in the suite, renames every other
identifier to `<prefix>_Test<n>` consistently within the file, replaces every
email with `owner@example.com`, blanks every address but its country, the phone
numbers, client secrets and idempotency keys, names the customer `Test Owner`,
replaces tax id values and hosted invoice links, and leaves the rest alone.
`raw/` is ignored by git. Delete it afterwards, delete the triggered
customers in the sandbox, and record the capture date and the scenario each file
came from here.

When the pinned API version changes, recapture rather than hand-edit.
