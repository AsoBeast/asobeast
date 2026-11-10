---
paths:
  - "apps/api/src/reviews/**"
  - "apps/web/src/app/**/reviews/**"
  - "apps/web/src/components/reviews/**"
  - "apps/web/src/lib/review-reply-cache.ts"
---

# Review rules

## Domain rule 21: A review reply is a stored row the owner approves; the store is written only by a person's click

Reply state:

- `ReviewReply` (RLS, `@@id([reviewId])`, cascades with review and app, referencing `(reviewId, appId)` so it can only name its own app's review) holds one reply: `text`, provenance (`tone` validated against `REVIEW_REPLY_TONES`, `model`, `generatedAt`, null when hand written) and the owner's `repliedAt` mark.
- "Replied" has two sources: `Review.repliedAt` (the daily Play sync stores it with `Review.replyText`) or `ReviewReply.repliedAt`. `replyStateOf` in `@asobeast/shared` is the rule for a loaded row and `replyStateWhere` (`reviews/review-list-query.ts`) the same rule as a query. A row without a mark is `drafted`; App Store reviews are replied only by the mark.
- `updated` is a Play review whose `reviewedAt` is after the store's `repliedAt`. The sync takes newer edits (`storedReviewChanges`: score, title, text, version, date; no alert) and later reply dates; `replyStateWhere` compares the columns through `prisma.review.fields.repliedAt`. The owner's mark never makes a review `updated`, nor is an App Store review ever.

Writing and drafting:

- `ReviewRepliesService` writes the row and `App.replyGuidelines`, holds the trimmed text to `REVIEW_REPLY_LIMITS[store]` with `countChars` (400 past it; the DTO `MaxLength` is only the outer bound), refuses a body with neither text nor a non-null `replied` with 400 before any lookup, and deletes the row when a mark is undone with no text left. Play publishes 350 characters; `APP_STORE: 2000` is asobeast's own ceiling.
- `ReviewReplyAssistant` drafts with one `AiGateway.spend` under `reviewReply`, from the review, the app, the newest home snapshot's version and release notes, the guidelines, up to three recent Play replies, the tone and the owner's instruction line, never another review or app. `fitReply` cuts to the store limit on a sentence boundary, never inside a surrogate pair, and reports `truncated` rather than spending again. It never touches `repliedAt`.
- The review, release notes and previous replies are untrusted: one JSON block closed by `END_OF_REFERENCE`, below the owner's guidelines and instruction line. A draft holding a link or email address neither contains is refused with 502 (`foreignContacts`), and the call stays counted.
- Google forbids soliciting, so no draft asks for a better rating, promotes, or adds a link or address the guidelines lack.

The composer:

- It works without an AI key; AI only fills the textarea. `measureReply` (`components/reviews/reply-text.ts`) measures the trimmed text the service counts, so the counter, `aria-invalid`, **Copy** and **Mark as replied** agree.
- It never discards on blur: emptied text shows a hint, and **Discard** behind its confirmation is the only way to remove a reply (it also removes the mark and the draft's provenance).

Lists and themes:

- `GET /apps/{id}/reviews` filters by `replyState` and `from` (first UTC day written), sorts `newest` or `lowest`, embeds `reply` on every row and answers `counts` under the star, version and `from` filters, never under `replyState`.
- `GET /apps/{id}/reviews/themes` (`reviewThemes` on `reviewPhrases`, up to four words, `themeIgnoredWords` kept off a phrase's edges) calls no store and no model. Each phrase of the newest `REVIEW_THEMES_BASELINE` reviews under the version and `from` filters gets a binomial surprise score for its share of reviews at or below `ALERT_REVIEW_SCORE_MAX` against the period's smoothed share. The majority side is judged by lean, the other by `REVIEW_THEME_SURPRISE`, each with at least `REVIEW_THEME_MIN_REVIEWS`. Counts come from the first `REVIEW_THEMES_CAP` (200) reviews under every list filter in the list's `sort`; only then is a shorter phrase dropped for a longer one covering three quarters of its mentions, so a star filter narrows counts, never the judgement.
- Each review drops the function words of the storefront's languages and its guessed language, or, when the guess is null, of every language tied for the most function words it holds (`reviewLanguages`).

Translation:

- A translation lives on the `Review` row (`translationLanguage`, `sourceLanguage`, `translatedTitle`, `translatedText`, `translatedAt`), one language at a time. `ReviewTranslator` returns a kept translation for the same language free; otherwise one `AiGateway` call under `reviewTranslation` after every refusing check (unknown review, no words, unknown language). The sync clears it (`TRANSLATION_CLEARED`) when an edit changes title or text, and the write matches the translated title and text, so a translation of replaced text is answered but not kept. Same untrusted block and `foreignContacts` refusal as drafts.
- `ReviewItem.language` (`reviewLanguage`: script, then function words, `null` when unsure) only decides where the web offers **Translate**, falling back to the storefront's language.

Posting to the store:

- `POST` and `DELETE /apps/{id}/reviews/{reviewId}/reply/post` (`ReviewReplyPoster`) send the kept `ReviewReply.text`, take no body, are `@SessionOnly()`, open to members, synchronous, never queued or retried. A post checks the store limit first, opens the connection (`openAppStoreReviews`, `openPlayPublisher`; 409 without a usable one), and on success writes in one transaction `ReviewReply.postedAt`, `postedText`, `postState` (`pending` until Apple publishes, `published` for Google; `REVIEW_POST_STATES`), `storeResponseId`, `postedByUserId`, `repliedAt`, and `Review.repliedAt` and `replyText`, so every reader sees a real reply with no new state.
- The App Store feed's review id is not App Store Connect's: `AscReviewLocator` lists the home territory's customer reviews newest first down to three days before `reviewedAt` (at most `ASC_REVIEW_LOCATE_MAX_PAGES` without a date), `matchCustomerReview` matches rating, title, body and nickname and refuses two indistinguishable candidates, and the id is kept in `ReviewReply.storeReviewId` (a kept id answering 404 is located again once).
- A second post updates (Apple overwrites, Google edits); `isPostEdited` derives "edited since posting". Withdraw exists for the App Store only (`DELETE /v1/customerReviewResponses/{id}`): it clears the post columns and the two `Review` columns, keeps the text and `storeReviewId`; on Play it answers 409.
- A 403 on a review resource is a missing role, not a rejected key: it sets `StoreConnection.replyAccess` to `forbidden` (`allowed` after a success, reset by a verify or a new key), answers 403, and the connection stays active. A Google sign in can post only if it granted `androidpublisher` (`GoogleAccountCredentials.canReply`); otherwise it is `forbidden` from connect and answers 409 `PLAY_REPLIES_NEED_CONSENT`. Store errors map to HTTP in `review-reply-post-errors.ts`.
- `reviews.reply_negative` reads the store's reply on Play only, not the owner's mark; its link opens `?replyState=needs_reply&sort=lowest`. A review spike is judged by `reviewedAt`, never the stored day, so a backfill never raises one.
