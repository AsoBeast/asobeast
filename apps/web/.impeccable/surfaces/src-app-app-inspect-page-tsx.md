---
version: 1
slug: "src-app-app-inspect-page-tsx"
primary_target: "src/app/(app)/inspect/page.tsx"
related_targets: ["src/components/keyword-inspections"]
---

# Keyword inspector surface brief

Scope: the `/inspect` route of the AsoBeast web app (fork). Visitor mode: Operate.

Audience and job: small teams and agencies exploring around a seed keyword in one storefront, hopping through autocomplete suggestions and inspected neighbours to find keywords worth targeting. Pain point named by the user: the old page was one long, flat stack of same-looking cards.

Constraints: AsoBeast's existing design system is binding (IBM Plex, semantic score, zone and state tokens, shadcn based components, recharts). Layout, hierarchy and interaction change; the visual identity does not. Existing API and contracts stay as they are.

## Direction contract

THESIS: Exploring is movement on one map. Every completed inspection in the current storefront is a point on a popularity by difficulty plot using the app's own keyword zones, and the page refuses the category default of a form over a long report.

OWN-WORLD: AsoBeast as shipped: warm neutral ground, white hairline cards, IBM Plex Sans with Plex Mono figures, score blues for points, zone tints from the tracked keyword map, brand orange only for the selected keyword and the primary action.

STORY: The visitor sees where the current keyword sits against everything inspected before, reads its scores and top 10 beside it, then inspects the next suggestion and watches it land on the map.

FIRST VIEWPORT: Title and the inspect form in one band (one row at desktop width, the form prefilled from the selected inspection). Below, a two column split: the keyword map card fills the left (chart plus a "Next from" suggestion rail under it); the selected keyword column on the right holds the keyword, three score tiles, the change since the last run and the top 10. The inspection log starts below the fold.

FORM: Opportunity map, dealt position 4 of 7 in my ordered list; seed: not recorded (the surface roll printed only a session key, no seed reference). Signature interaction: a suggestion chip starts an inspection in place and shows it running; the finished keyword lands on the map with a short entrance but is not auto selected, so several suggestions can be explored in parallel; hovering or focusing a chip marks its point. Raises kept: next hops re-sign after every inspection; apps that entered the top 10 since the last run carry a New badge.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Whether "entered the top 10" highlights should persist until seen per viewer (not built; would need per viewer state).
