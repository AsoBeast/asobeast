---
paths:
  - "apps/api/src/alerts/**"
  - "apps/api/src/apps/listing-alerts.service.ts"
  - "apps/api/src/reviews/review-spike*.ts"
  - "apps/web/src/app/**/{alerts,confirm-alert,unsubscribe}/**"
  - "apps/web/src/components/alerts/**"
  - "apps/web/src/lib/alerts-seen.ts"
---

# Alert rules

## Domain rule 17: Alert emails are subscription mail; account and billing emails are transactional

- Every alert email carries RFC 8058 `List-Unsubscribe` and `List-Unsubscribe-Post` headers when `WEB_PUBLIC_URL` is https, and a footer link to `/unsubscribe`. Account and billing mail never carry them. Every email carries `Auto-Submitted: auto-generated`.
- `POST /email-alerts/{id}/unsubscribe?token=` is public, checks an HMAC of the alert id and its current address under `AUTH_SECRET` (an address change retires old links), deactivates only that alert, answers 204 and never redirects; a `GET` never unsubscribes. The worker sends only to active alerts.
- A report's HTML stays under 90 KB: `formatBatchEmail` lowers its per block line cap only while the HTML would exceed it; the text part keeps every cap.
- `rating.dropped` (`ListingAlerts`, `apps/listing-alerts.service.ts`, from a primary app's home capture, only when the displayed average fell by whole tenths and deepened since the previous capture) and `review.spike` (`ReviewSpikeAlerts`, `reviews/`, when this sync's inserts put a day over `max(5, 3 × median of 28 days)`) are raised from stored rows and write their outbox row whether or not a channel listens. A channel's `ratingDropTenths` filters drops at delivery (`withRatingDropsAtLeast`, `receivesInstant`); `ESSENTIAL_ALERT_EVENTS` names a default subscription's events.
- A subscription's `rankDropThreshold` filters at delivery only, clamped to at least `ALERT_RANK_DROP_THRESHOLD`, because `AlertsDispatcher.collect` records every detected move for the feed first.
- The first daily completion after a workspace's first ranked primary app creates one essential email alert to the owner (`DefaultAlertsService`, called by `DefaultAlertsRun` before the flush) when mail works and `WEB_PUBLIC_URL` is https, claiming `Workspace.defaultAlertsAt` in the same transaction. Every hand made `EmailAlert` or `Webhook` claims the same marker, so defaults exist once and never return after a delete or unsubscribe. The first email of a `defaultOrigin` alert opens with one sentence claimed through `introSentAt`.
- A daily update's subject is `leadOf`'s sentence; moves are ordered by `moveImpact`, five rows per rank group.

## Domain rule 19: An email alert recipient confirms the address before anything is mailed to it

Confirmation:

- `EmailAlert.confirmedAt` stays null until the recipient presses the button on `/confirm-alert` (unless the address is confirmed at creation, below), which posts to the public `POST /email-alerts/{id}/confirm?token=` (never a `GET`). The token (`confirmation-token.ts`, on `link-token.ts`) is an HMAC of the alert id, the lowercased address and `confirmationSentAt`, so a new send, an address change or an unsubscribe retires every earlier link; it expires after `CONFIRMATION_DAYS` (7).
- `confirmationSentAt` is reserved before the mail leaves by a conditional update against the row read, so of two concurrent sends one goes out. A resend reserves it before claiming the daily allowances, so a resend that loses spends nothing and meets the cooldown. A failed send restores the earlier time (keeping the earlier link), and every path that sends nothing gives both allowances back, even a transaction that fails after claiming them. Create and update answer optional `confirmationSent` whenever they asked for confirmation.
- Every delivering reader of `EmailAlert` (`AlertsDispatcher`, `AlertFlushService`, `AlertsWorker`, and any new one) goes through `DELIVERABLE_EMAIL_ALERTS` or `isDeliverable`. The test send needs only a confirmed recipient, so a paused alert can be tested.
- An address is confirmed at creation only when it is the verified account email of a member of the same workspace (scoped by the RLS policy on `User`). Everything else waits, fail closed: without `WEB_PUBLIC_URL` no link can be built, so nothing is mailed (`EmailAlertConfirmation.canSend`). An address change resets confirmation and mails the new address.
- An unsubscribe withdraws confirmation and stamps `unsubscribedAt`, so resend answers 409 until the address changes and the alert no longer counts as waiting. The confirmation email carries the unsubscribe link; optional `EmailAlertItem.unsubscribed` lets the settings row say so. The confirmation email is transactional (`sendAccountMail`, kind `alert-confirmation`).
- The default alert confirms at creation when the owner's address is verified; where verification is not required (`BILLING_ENABLED=false`) it is created waiting and the email goes to the owner as `AsoBeast`; where it is required, an unverified owner waits with the marker unset. Optional `EmailAlertItem.confirmed` absent means confirmed.

Rationing:

- Create, update, resend and test are each limited to 10 a minute per workspace (`RetryAfterThrottlerGuard`).
- A workspace holds at most `MAX_EMAIL_ALERTS` (25) email alerts, `MAX_UNCONFIRMED_EMAIL_ALERTS` (5) unconfirmed (403), counted and written under a per workspace `pg_advisory_xact_lock`.
- A resend waits `CONFIRMATION_RESEND_COOLDOWN_SECONDS` (one hour) after the last confirmation sent (429).
- `ConfirmationMailLimiter` allows 20 confirmation mails a day per workspace and 5 per recipient mailbox across workspaces, keyed by `sha256(mailboxOf(address))` (domain rule 9's reduction), checking both in one script and counting only when both have room, failing closed through `FailFastRedis` with 429.

## Domain rule 24: The alert feed reads what the run recorded, never what a channel received

- `GET /alerts/events` (`AlertEventFeed`) lists `AlertEvent` rows of the last `ALERT_FEED_DAYS` (30) days newest first, keyset paged by `(createdAt, id)` with an opaque cursor, for every member and any `asob_` token, with or without a subscription.
- The daily run writes every detected event's outbox row before consulting subscriptions (`AlertsDispatcher.collect`); `ALERT_DELIVERY=instant` writes it already settled (`flushedAt` set, never claimed by the flush, and a failed record never stops delivery). Only `review.new` is gated on a listener; the feed leaves it out with `digest.weekly`. `ALERT_FEED_EVENTS` is `WEBHOOK_EVENTS` minus `ALERT_FEED_EXCLUDED_EVENTS`, so a new event joins by joining `WEBHOOK_EVENTS`, and needs an `outboxRows` branch to get a feed row.
- Not listed: the confirmed copy of a drop or exit (`CONFIRMED_KEY_PREFIXES`), events of a removed app (`AlertEvent.appId` has no foreign key), and an unwordable payload (skipped with a warning).
- The sentence is `sentenceOf(payload, false)`, the one wording of every channel; the web builds the link from the typed payload and `primaryAppId`, so the API never knows a web route. `AlertEvent.keywordId` lets `appId` find entrants (`appId` null) of keywords the app actively tracks; older rows carry none.
- The instance floors (`ALERT_RANK_DROP_THRESHOLD`, `ALERT_REVIEW_SCORE_MAX`, `ALERT_ACTIONS_MIN_PRIORITY`) decide whether an event exists; a subscription threshold filters only delivery, so the feed never shows just what the strictest subscription asked for.
