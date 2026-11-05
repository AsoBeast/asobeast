# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Small teams and agencies researching and tracking App Store Optimization keywords for several apps, often client apps, across several storefronts. They work in a self-hosted AsoBeast instance, usually at a desk, alongside the stores themselves and their own listing copy.

## Product Purpose

AsoBeast is an open source App Store Optimization tool and keyword rank tracker for the Apple App Store and Google Play. It imports listings, tracks keyword rankings daily to a depth of 200, watches competitors, reviews and metadata, and turns that history into a prioritized queue of ASO work. Success is a team that knows which keywords to target and sees their rankings move.

## Positioning

Self-hosted and vendor-free: every store request runs from the user's own server as an ordinary public search, so no ASO vendor sees or resells the keyword list. Scores are estimated from public store signals (search results, autocomplete) and, when connected, Apple Ads popularity, with their source and confidence always shown.

## Operating Context

- Keyword research starts from a seed phrase and branches through store autocomplete and the apps that rank for it.
- The Keyword inspector (`/inspect`, this fork) runs an on-demand, untracked inspection of any keyword in any storefront: live top results, autocomplete suggestions, popularity, difficulty, opportunity, a top-ten competition summary, and a comparison with the previous run of the same keyword.
- Inspections run as queued jobs and complete in seconds; the page polls while one is pending.
- The same data is reachable through the REST API and the MCP server, so agents and scripts are first-class consumers.

## Capabilities and Constraints

- Stores: Apple App Store and Google Play; storefront is a two-letter country code.
- Keywords are normalized (lowercased, trimmed, at most five words).
- Inspection results keep the top 50 store results and up to 10 autocomplete suggestions.
- Store capacity is rate limited; each inspection spends capacity, and repeating a pending inspection returns the same run.
- This is a fork of the upstream AsoBeast project; changes should stay additive and easy to rebase.

## Brand Commitments

- The established AsoBeast app design system (IBM Plex Sans and Mono, its semantic score, grade and rank-band colour tokens, its component library) is binding for app surfaces. The user confirmed that the Keyword inspector redesign keeps this system and changes layout, hierarchy and interaction only.
- Docs and UI copy avoid dash punctuation and use plain language.

## Evidence on Hand

- Playwright mock API fixtures under `apps/web/e2e/` provide synthetic demonstration data; app names in them are invented.
- No customer testimonials, benchmarks or usage figures exist; none may be invented.

## Product Principles

1. Show where every number comes from: source, formula and confidence travel with each score.
2. Research is a path, not a page: every keyword, suggestion and competitor should lead to the next question.
3. Dense but legible: teams scan many keywords, so hierarchy beats volume.
4. The user's data stays theirs: nothing leaves the deployment without an explicit integration.
