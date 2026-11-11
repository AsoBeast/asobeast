---
name: AsoBeast
description: The signed in App Store Optimization app, set to the finish level of Vercel, Plausible, Linear and Adapty, in the brand's own orange.
colors:
  brand: "#f89820"
  brand-ink: "#1c1408"
  series: "#d2700a"
  series-tint: "#fbeedb"
  series-dark: "#f89820"
  series-tint-dark: "#2b2114"
  previous: "#cdc8c0"
  previous-dark: "#3d3933"
  info: "#1d4ed8"
  info-dark: "#60a5fa"
  up: "#137a3a"
  up-tint: "#e4f5e9"
  up-dark: "#4ade80"
  up-tint-dark: "#0d2a18"
  down: "#c2272d"
  down-tint: "#fde6e6"
  down-dark: "#f87171"
  down-tint-dark: "#3b1414"
  warn: "#a3520a"
  warn-dark: "#f0b64a"
  page: "#faf9f7"
  surface: "#ffffff"
  surface-2: "#f4f2ee"
  line: "#e7e4df"
  line-2: "#eeebe6"
  ink: "#1c1917"
  ink-2: "#6b665f"
  ink-3: "#716b64"
  page-dark: "#0c0b0a"
  surface-dark: "#141311"
  surface-2-dark: "#1c1a17"
  line-dark: "#2a2724"
  line-2-dark: "#221f1c"
  ink-dark: "#efece7"
  ink-2-dark: "#a39d94"
  ink-3-dark: "#8a847b"
typography:
  title:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  metric:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  dense:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0"
  caption:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.35
  tick:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.3
rounded:
  tag: "4px"
  control: "6px"
  panel: "8px"
  overlay: "12px"
  avatar: "6px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "34px"
    padding: "0 14px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "34px"
    padding: "0 12px"
  pill-up:
    backgroundColor: "{colors.up-tint}"
    textColor: "{colors.up}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "22px"
    padding: "0 7px"
  pill-down:
    backgroundColor: "{colors.down-tint}"
    textColor: "{colors.down}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "22px"
    padding: "0 7px"
  pill-flat:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "22px"
    padding: "0 7px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "0"
  panel-header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.heading}"
    padding: "12px 16px"
  metric-tab:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.metric}"
    padding: "14px 20px 16px"
  table-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.dense}"
    height: "44px"
    padding: "0 16px"
  list-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.dense}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 8px"
  nav-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    typography: "{typography.dense}"
    rounded: "{rounded.control}"
    height: "32px"
    padding: "0 8px"
  nav-item-active:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.dense}"
    rounded: "{rounded.control}"
    height: "32px"
    padding: "0 8px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.dense}"
    rounded: "{rounded.control}"
    height: "34px"
    padding: "0 10px"
---

# Design System: AsoBeast

## Overview

**Creative North Star: "The Morning Standings"**

AsoBeast is opened once a day, after the daily run, to learn what moved. The system is built for that glance: one calm page of panels on a warm neutral ground, a single orange that belongs to the brand and to the data alike, numbers set in tabular figures that line up like a standings table, and change always written as a signed figure beside its value. It sits at the finish level of Vercel, Plausible, Linear and Adapty, which the owner named as the bar, and it is the category standard played straight rather than a theme: a visitor who has used any of those products knows where everything is before they notice the colour.

The old look is the anti-reference. It boxed every section in the same card with a grey sentence under its title, repeated a pill for every attribute, put an icon beside every heading, spread text over two sizes and used the brand orange, blue, amber and a mono face at once. This system replaces that with a short type scale, panels only where a block is an object, pills only for a change or a state, icons only where a row needs a type glyph, and one accent family.

**Key Characteristics:**

- One sans face, Geist, with tabular figures everywhere a number can be compared.
- One hue family for the brand and the data: the brightest shade on the single primary button, a deeper shade on chart lines, the palest tint behind inline bars.
- Green and red mean direction and nothing else, and never travel without a sign, an arrow or a word.
- Flat panels with a hairline border on a warm neutral ground; no shadow below an overlay.
- A metric strip that drives one chart, a sentence that says what moved, lists with inline bars, tables at 44 px.

## Colors

A warm neutral ground with one orange family and two signal hues, mirrored in a dark theme that is one step lighter per layer rather than a shadowed one.

### Primary

- **Brand Orange** (#f89820): the fill of the one primary button in a view, the active chart series in the dark theme, and nothing else in the light theme. It is never text on a surface (2.1:1 on white) and never a decoration.
- **Burnt Orange** (#d2700a): the chart series, sparklines and the end dot in the light theme, where the brand shade is too light to read as a line. Inline bars behind list rows use its palest tint (#fbeedb light, #2b2114 dark).
- **Previous Period** (#cdc8c0 light, #3d3933 dark): the comparison line under the series; always thinner and never filled.

### Secondary

- **Information Blue** (#1d4ed8 light, #60a5fa dark): reserved. It marks an informational badge or link where "info" must differ from the brand, and the second series of a multi series chart. It appears on none of the three redesigned screens by default.

### Signals

- **Up** (#137a3a on #e4f5e9; dark #4ade80 on #0d2a18) and **Down** (#c2272d on #fde6e6; dark #f87171 on #3b1414): the direction of a change, as a pill or as coloured text with a sign. Up means better, so a position that fell from 14 to 6 is up.
- **Warn** (#a3520a light, #f0b64a dark): the word "High" in a priority column and a stale check; never a fill. **Critical** uses the down red.

### Neutral

- **Page** (#faf9f7 light, #0c0b0a dark): the ground every panel sits on.
- **Surface** (#ffffff light, #141311 dark): panels, the sidebar, the top bar, table rows.
- **Surface 2** (#f4f2ee light, #1c1a17 dark): the segmented control track, the active sidebar item, a hover row, a flat pill.
- **Line** (#e7e4df light, #2a2724 dark) and **Line 2** (#eeebe6 light, #221f1c dark): panel borders and header rules, then the lighter divider between rows.
- **Ink** (#1c1917 light, #efece7 dark), **Ink 2** (#6b665f light, #a39d94 dark) and **Ink 3** (#716b64 light, #8a847b dark): text, secondary text, and labels, captions and axis ticks. Every pair passes 4.5:1 on its surface in both themes.

### Named Rules

**The One Family Rule.** The brand orange and the data orange are shades of one hue; nothing else on a screen is orange. A warning is a word, not an orange fill, and the active navigation item is neutral.

**The Direction Only Rule.** Green and red appear on a change, a signal or a critical word, and on nothing that is merely a category. Grades are words with a quiet marker, never a painted column.

**The No Blue By Default Rule.** Blue is held in reserve for information badges and a second series. It never leads a screen.

## Typography

**Display Font:** Geist (with -apple-system, Segoe UI, sans-serif)
**Body Font:** Geist (same face)
**Label/Mono Font:** none; identifiers that need a monospace use the system monospace stack, and a number never does.

**Character:** one neutral grotesk at a short scale, with weight doing the small steps and size doing the two big ones. Numbers use the face's tabular, lining figures (`font-variant-numeric: tabular-nums`) wherever they can be compared. Geist is the face of one of the products set as the bar; it is widely used, which is accepted here as a brand commitment.

### Hierarchy

- **Title** (600, 22px, 1.2, -0.02em): the page title, once per page.
- **Metric** (600, 28px, 1.1, -0.02em): the value of a metric tab or a headline figure, with its delta pill beside it; at most one strip of them per page.
- **Heading** (600, 14px, 1.4): a panel or section heading, every section, one size.
- **Body** (400, 14px, 1.45): the lede sentence, action titles, dialog text; prose keeps to 70ch.
- **Dense** (400, 13px, 1.45): table cells, list rows, navigation, controls. Names in a row take 500.
- **Label** (500, 12px, sentence case, no tracking): column headers, metric tab labels, metadata lines, pill text.
- **Caption** (400, 12px): metadata lines and notes under a figure.
- **Tick** (400, 11px): chart axis ticks and sidebar group labels only.

### Named Rules

**The Five Sizes Rule.** A screen uses title, heading, body or dense, label or caption and tick, plus the metric size in one strip. No raw `text-sm` or `text-base` in a primitive; every size is a named step.

**The Sentence Case Rule.** Labels and column headers are sentence case with no letter spacing; the old tracked uppercase label is retired.

**The Tabular Rule.** A number that sits in a column or beside another number is tabular, right aligned with its header, with one count of decimals per column and the unit in the header; dates and ids stay left.

## Layout

The shell is a 232 px sidebar on the surface colour with a hairline right border and a 52 px top bar that carries the breadcrumb, the run status and the command key. Page content sits on the page colour with 32 px side padding at desktop and the density gutter below `sm`, inside the existing width utilities (`page-wide` at 1600 px for the dashboard and overview, `page-full` for the keywords table).

Vertical rhythm is a 4 px scale: 24 px between the page header and the first panel, 20 px between panels, 12 px between a panel header and its rows, 8 px inside a list, 16 px of horizontal padding in a table cell and a panel header. A panel header is 12 px over and under its 14 px heading with a hairline below; a panel footer repeats that in label size.

Sections are separated by space and panel edges, never by a tinted band. Two column areas use a 1.3 to 1 grid at and above 1024 px and stack below; the dashboard keeps its `@container/dashboard` queries so the sidebar's width is not a proxy for the content box. At 375 px the metric strip becomes a two by two grid, tables drop to app, value and change, lists keep their bars, and the status line leaves the top bar.

### Named Rules

**The Object Rule.** A panel exists only around a block that is an object: a metric strip with its chart, a list, a table, the action queue. Headings, sentences and a lone figure sit on the page.

**The Two Densities Rule.** Lists are 36 px rows, tables 44 px with a 36 px compact option, navigation 32 px. Nothing in the shell is taller than 44 px except a chart.

## Elevation & Depth

Flat by default. A panel is a surface with a 1 px line on the page colour; the dark theme conveys the same hierarchy with a surface one step lighter than the page and a lighter line, never a shadow. Hover is a surface step, selection is the surface 2 tint plus a 2 px inline start bar in ink, so a selected row can be told from a hovered one.

### Shadow Vocabulary

- **Segment** (`0 1px 2px rgba(0,0,0,0.06)`): the raised pill of a segmented control, the one shadow in the shell.
- **Overlay** (`0 8px 24px rgba(0,0,0,0.12)` light; `0 1px 0 rgba(255,255,255,0.06) inset, 0 12px 32px rgba(0,0,0,0.6)` dark): menus, popovers, dialogs and sheets.

### Named Rules

**The Flat Page Rule.** No shadow below an overlay. A flat container carries a line or a tint, never both plus a shadow.

## Shapes

A restrained radius scale by role: 4 px on tags and checkboxes, 6 px on buttons, inputs, pills, segmented controls, list row hover and app icons, 8 px on panels and the table frame, 12 px on menus, popovers and dialogs. A child radius never exceeds its parent, and nothing in the shell is rounder than 8 px except an overlay. Borders are 1 px hairlines in the line colour; the metric strip divides its tabs with vertical hairlines and marks the active tab with a 2 px ink underline on the panel edge.

## Components

### Buttons

- **Shape:** gently rounded (6 px), 34 px tall, label size at 500.
- **Primary:** brand orange fill with near black ink (#1c1408), one per independent task in a view; hover darkens the fill one step. A trigger that only opens a dialog is outline, never primary.
- **Outline:** surface fill with a hairline border; **Ghost:** no border, hover to surface 2. A control that starts a request stays focusable with `aria-disabled` and dims; it is never `disabled`.
- **Focus:** a solid 2 px ink ring everywhere, offset by 2 px from a filled control (the primary button, a checked box, a switch); nothing translucent. An orange ring is about 2:1 on the page, so the ring is never orange.

### Pills

- **Style:** 22 px tall, 6 px radius, label size at 500, tinted fill with its own text colour. Variants: up (green), down (red), flat (surface 2 with ink 2), and the state words Paused and Checking in flat.
- **Use:** a change (the delta beside a metric, the 7 day column, an alert's size), a state that changes, or ownership in a change feed (yours, competitor). Never a source, a store, a market, a tag or a category, which are text; never a pill that would appear on every row of a list.

### Priority words

- Critical in the down red, High in warn, Medium and Low in ink 2, as 11 px uppercase words with 0.04em tracking in a 64 px column before the action title. They are the one uppercase label in the system, because a priority is read as a mark, not a word.

### Panels

- **Corner Style:** 8 px.
- **Background:** surface, with a hairline border; the header is 12 px over 16 px with the heading at the left and a count, a segmented control or a range control at the right; a footer line in label size and ink 3 says when and how deep the data was read, with its link at the right.
- **Shadow Strategy:** none (see Elevation).
- **Internal Padding:** 16 px in headers and table cells, 8 px around a list so its 36 px rows can carry a hover and a bar.

### Metric strip

- The first panel of a page: three or four metric tabs divided by vertical hairlines, each with a label, a 28 px value and its delta pill on one line, then a one line note in ink 3. The active tab carries a 2 px ink underline and decides what the chart below shows. On a phone the strip is a two by two grid.

### Charts

- One area or line chart per panel, 268 px tall at desktop and 200 px below `md`, drawn through the chart system in `components/charts/theme.ts`. The series is the data orange at 2 px; the previous period is the previous grey at 1.5 px; the fill is a 16 percent to 0 vertical fade of the series; the grid is horizontal hairlines in the line 2 colour with 11 px ticks in ink 3; the axis has no line. A day whose checks are still running is a dashed segment that ends in a hollow dot. The legend sits in the panel's top right in label size, never inside the plot. Integer counts use step interpolation, never monotone curves. Rank charts keep the reversed square root axis and draw rank bands as one orange ramp of five tints with unranked in surface 2; a multi series chart uses the series palette (orange, information blue, teal #0f766e, violet #7c3aed, rose #db2777, grey #6b7280) with the existing dash patterns, and a legend in band or rank order. A sparkline in a table is 72 by 22 px, the series colour at 1.5 px, no fill, no axis.

### Breakdown lists

- A panel of 36 px rows: a 16 px app icon, the name at 500, a market code in ink 3, then right aligned figures. Behind the name a bar in the series tint whose width is the size of the move, capped at 20 positions, so the eye reads magnitude before the number. The change column is a signed figure with an arrow in the direction colour; "new" and "lost" are written as words.

### Tables

- The table kit, 44 px rows with 16 px cell padding, 12 px sentence case headers in ink 3 over a hairline, 13 px cells, no zebra, a lighter line between rows, hover to surface 2. Numeric columns and their headers are right aligned and tabular; a name cell holds a 24 px app icon, the name at 500 and a 12 px ink 3 line under it. The keyword table keeps 44 px rows, right aligns its score columns, shows change beside position, fits its default columns inside its frame from 1280 px and keeps a slim meter under each score. A totals footer repeats the header style and counts: keywords, ranked, not ranking, in the top 10, moved up, moved down.

### Navigation

- The sidebar: the mark and the product name at 14 px 600, a workspace switcher as an outlined 6 px control, then 32 px items at 13 px 500 in ink 2 with a 16 px lucide icon at 1.6 stroke, the active item on surface 2 in ink; a count sits at the right in ink 3. Below a 11 px group label, the apps are listed with their 16 px icons. The top bar is 52 px with the breadcrumb at the left and the run status (a 7 px dot plus a sentence) and the command key at the right; the status collapses to its dot below `sm`.

### Inputs and selects

- 34 px tall, 6 px radius, hairline border, surface fill, 13 px text; a select shows a 16 px calendar or chevron icon. Focus is a 2 px ink ring. The segmented control is a surface 2 track with 2 px padding and a raised surface pill for the active option.

### App icons

- The store's own icon at 24 px in a table and 16 px in a list, 6 px radius. The fallback is a neutral silhouette on surface 2, never a letter tile.

### States

- **Loading:** skeleton blocks in surface 2 at the real geometry; the pulse stops under reduced motion; a loading region announces itself.
- **Empty:** one sentence saying what is missing and the one action that fills it, left aligned inside the panel, no icon.
- **Error:** the shared error state; a secondary section uses the inline query error.
- **Stale and checking:** a 16 px clock with the day of the last check in label size; **Checking…** with a 14 px spinner; a found nothing position reads ">200 (was #14)" in ink 2 on one line.

### Motion

- 150 ms ease out on hover, focus and segmented changes; 200 ms on overlays; no entrance animation, no chart draw in on a data refresh, no pulsing dot. Reduced motion stops everything but a spinner.

## Do's and Don'ts

### Do:

- **Do** open every page with a page title and, where the page is daily, one sentence that says what moved since the last run.
- **Do** put the metric strip first and let its active tab drive the one chart below it.
- **Do** write every delta with a sign or an arrow and colour, never colour alone, and keep green for better and red for worse.
- **Do** right align every number that can be compared, with its header, in tabular figures.
- **Do** keep one primary button per view and make dialog triggers outline.
- **Do** use the store's own app icon everywhere an app is named in a row.
- **Do** separate sections with space and panel edges, and say in a footer line when and how deep the data was read.

### Don't:

- **Don't** put a muted sentence under a heading, an eyebrow above it, or an icon beside it.
- **Don't** box a heading, a sentence or a lone figure in a panel, and never nest a panel in a panel.
- **Don't** use a pill for a source, a store, a market, a tag or a category, or on every row of a list.
- **Don't** use orange for a warning, a data bar on another page, a link underline or an active navigation item.
- **Don't** colour a position or a score by grade; show the grade word with a quiet marker: a filled dot for strong, a half filled one for weak, a ring for poor, none for fair.
- **Don't** draw a sparkline fill or a shadow below an overlay. A meter under a number belongs to the keywords table only, where the owner asked for it.
- **Don't** use uppercase tracked labels, a second typeface, or a monospace face for numbers.
- **Don't** render a letter tile where an app icon belongs.

## Screens

The per screen intent for the three redesigned pages; the components above supply the parts.

### Dashboard

Page title "Dashboard" with the lede sentence and a "See all moves" link; at the right the range select and the primary "Import app". Metric strip: Visibility, Keywords in top 10, Moved since yesterday, Open actions, driving the visibility chart with the previous period and the dashed unfinished day. Then two panels: Keyword movers as a breakdown list (All, Climbers, Fallers) with a footer naming the check time and depth, and Do next with five priority word rows and an Action Center link. Then the Apps panel as a table (app, trend, visibility, 7d, top 10, moved, rating, actions). Then Listing changes (a version run collapsed to one row) beside Alerts. An app with no history reads "Not enough history" in the trend cell.

### App overview

A header band on the page: the app icon at 32 px, the name as the title, store and market as text, the market select and the Print report outline button at the right, the snapshot facts as one ink 2 line. Metric strip: Visibility, Keywords in top 10, Average position, Rating, driving one chart that switches between visibility (with share of voice as a second series in information blue) and rank bands over time. Then Keyword movers beside Do next, as on the dashboard. Then the store funnel as a flat strip of figures with 7 and 28 day pills, only when a console reports. Then one panel group of the category rank chart and the ratings by market table. Metadata coverage becomes a short list under the movers panel's footer link, and the gap sentence joins the movers footer. Nothing on the page repeats the refresh date.

### Keywords

One heading row: the Tracked and Discovered segmented control, a market select with the keyword count of each market, then the Table and Map switch, Import CSV as an outline button and the primary "Add keywords". Under it one sentence: how many keywords are tracked and active, and how many moved up and down since yesterday. Then the table's own row: search, one Filters control (a popover from `md`, a bottom sheet below it) with its active chips under it, the shown count, Columns and Export. The table keeps 44 px rows with Keyword (listing marks as tinted underlines, the class as a 4 px tag, Paused as a flat pill), Position as a chip (tinted for the top 3, outlined for the top 10) with its 1 day change beside it, Last 7 days as a position line with the 7 day change, then Opportunity, Popularity and Difficulty each as a number over a slim meter in the grade colour, up to two coloured Insight badges and the Top apps column of three overlapping store icons with the own app ringed; Tags, Source, Volatility, Added, Competitors in top 10 and Reveal are hidden by default, the Top apps icons are one button into the search results, one row menu stays pinned at the right edge, and the default columns fit the table frame from 1280 px: a narrower frame shortens the keyword, then folds the second insight into a count and drops the 7 day line, then tightens the cell padding. A lost ranking stacks `was #14` in tick size under `>200`, so the Position column keeps one width. The totals footer counts keywords, ranked and not found, the top 10, and how many moved up and down over 7 days, beside the three averages. Suggestions and Keyword combinations are one line each when collapsed; the keyword field read of the market stays as a flat panel of rows and notes. The cross store note lives in the Popularity header's info popover.

## Migration map

Where each token lands in the code. Names stay where the app already uses them; values change.

- **Palette:** `styles/primitives.css` gets the warm neutral ramp (page, surface, surface 2, line, line 2, ink, ink 2, ink 3 in both themes), `--brand-500` stays the brand orange, `--brand-series` is the burnt orange and `--chart-1` uses it in light and the brand orange in dark, the previous period and series tint are new primitives. `styles/semantic.css` maps `--background`, `--card`, `--muted`, `--border`, `--foreground`, `--muted-foreground`, `--signal-up`, `--signal-down`, `--warning`, `--info` and `--chart-1` to `--chart-6` to them; `--accent` becomes the selection tint plus the inline start bar so selected, hovered and charted rows differ; `TEXT_PAIRS` in `components/tokens/token-groups.ts` and `tokens.test.ts` are updated to the new pairs.
- **Type:** `styles/typography.css` sets title 22, heading 14 (replacing `title` 18 and `subtitle` 15), body 14, dense 13, label 12 sentence case with no tracking, caption 12 and tick 11, and adds `metric` 28; `TYPE_STEPS` in `lib/utils.ts` learns the new names; `app/layout.tsx` loads Geist (the `geist` package or `@fontsource-variable/geist`) and drops IBM Plex; `--font-plex-sans` is renamed with it.
- **Radius and depth:** `--radius` stays 8 px with `sm` 4, `md` 6, `lg` 8, `xl` 8 and `2xl` 12 in `app/globals.css`; `--elevation-raised` becomes none and `--elevation-overlay` keeps the overlay shadow.
- **Primitives to change:** `ui/card.tsx` (panel: 8 px, line border, no shadow, header and footer slots, no description slot), `ui/badge.tsx` (pill: 6 px, up, down, flat and state variants), `ui/button.tsx` (34 px, 6 px, solid focus ring), `ui/table.tsx` (44 px rows, sentence case headers, a numeric column meta that right aligns head and cell), `ui/stat-tile.tsx` (becomes the metric tab), `ui/delta-chip.tsx` (the pill and the signed text form), `ui/empty-state.tsx` (sentence plus action, no icon, left aligned), `ui/tabs.tsx` (the segmented control), `ui/input.tsx` and `ui/select.tsx` (34 px, 6 px), `ui/skeleton.tsx` (surface 2, reduced motion), `ui/sidebar.tsx` with `layout/AppSidebar.tsx`, `SidebarNav.tsx` and `InsetHeader.tsx` (the shell), `components/AppIcon.tsx` (silhouette fallback), `charts/theme.ts` and `rank-layers.tsx` (series palette, fade, grid, dashed tail, step interpolation, band ramp), `data-table/SortableHeader.tsx`, `FacetFilter.tsx` and `FilterChips.tsx` (one Filters control, no funnel per facet).
