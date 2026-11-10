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
- Metadata coverage rules are home market only: `ActionContextLoader` asks `MetadataService.audit` for the home market, and no rule judges market listings yet (market rules are per country and say "investigate this market"). Home coverage already counts every saved keyword field the home storefront reads, so `keyword.add_uncovered` sees localized fields.
- Every lifecycle transition is recorded in `ActionEvent` (RLS, pruned with its action). A `DONE` action is confirmed (`verifiedAt`) the first run its rule stops firing and reopens if it fires again; outcomes are measured values of the rule's metric, never promises.
- `conversion.investigate_drop` and `listing.cpp_underperforms` read complete home market days of `StoreFunnelDay` and `StoreFunnelPageDay` through `ActionFunnelReader`, which keeps rows of an app the connection no longer reports (`StoreFunnelService.connectedApps`) marked `reporting: false`, so the rules hold an existing action `withheld` and open none without a connection. Both are advisory and measure outcomes by conversion; the page rule's discriminator is the page title.
