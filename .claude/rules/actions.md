---
paths:
  - "apps/api/src/actions/**"
  - "apps/web/src/app/**/actions/**"
  - "apps/web/src/components/actions/**"
---

# Action Center rules

## Domain rule 12: The Action Center is deterministic; AI is optional garnish

- Every recommendation in `apps/api/src/actions/` is a pure function of stored data with named exported constants and boundary tests. AI may only summarize an existing action, never create, rank, reorder or suppress one, and everything works with `OPENAI_API_KEY` unset.
- `fingerprint` is `sha256(rule~appId~store~country~keywordId~discriminator)` and excludes every volatile magnitude (positions, scores, counts, observation dates); including one would mint a new action every run and break the `open/snoozed/done/dismissed/resolved` lifecycle.
- Metadata rules judge every market listing: `ActionContextLoader` asks `MetadataService.audit` for the home market (`coverage`, `metadataFields`) and for each other market with an active tracked keyword (`marketMetadata`, `metadataMarkets`, ordered by country); a market whose listing was never captured has no audit and is skipped, never failing the app. Each audit counts every saved keyword field its storefront reads. `keyword.add_uncovered` judges a keyword by the listing of its own market. `metadata.fix_lint` reports a problem once, in the first market that shows it (home first): two markets reading the same localization serve the same field text, so a repeat of the same field, text and issues opens nothing. `keyword.push_to_top10` still reads home coverage only.
- A rule that would advise putting a keyword into a listing field asks `fitsOwnListing` (`keywords/keyword-class.ts`) first; a rule that only reports a keyword (`keyword.defend`) marks a competitor brand on its evidence instead of asking to strengthen it (domain rule 25).
- Every lifecycle transition is recorded in `ActionEvent` (RLS, pruned with its action). A `DONE` action is confirmed (`verifiedAt`) the first run its rule stops firing and reopens if it fires again; outcomes are measured values of the rule's metric, never promises.
- `conversion.investigate_drop` and `listing.cpp_underperforms` read complete home market days of `StoreFunnelDay` and `StoreFunnelPageDay` through `ActionFunnelReader`, which keeps rows of an app the connection no longer reports (`StoreFunnelService.connectedApps`) marked `reporting: false`, so the rules hold an existing action `withheld` and open none without a connection. Both are advisory and measure outcomes by conversion; the page rule's discriminator is the page title.
