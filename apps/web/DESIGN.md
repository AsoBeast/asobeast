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
  brand-text: "#a8520a"
  brand-text-dark: "#f89820"
  brand-mark: "#d2700a"
  brand-mark-dark: "#f89820"
  previous: "#cdc8c0"
  previous-dark: "#3d3933"
  info: "#1d4ed8"
  info-dark: "#60a5fa"
  series-2: "#2563eb"
  up: "#137a3a"
  up-tint: "#e4f5e9"
  up-dark: "#4ade80"
  up-tint-dark: "#0d2a18"
  down: "#c2272d"
  down-tint: "#fde6e6"
  down-dark: "#f87171"
  down-tint-dark: "#3b1414"
  warn: "#7c6200"
  warn-dark: "#e8c34a"
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
  hero:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.024em"
  title:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  metric:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  dialog:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.25
  heading:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.006em"
  body:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  dense:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  control:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.45
  label:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0"
  caption:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
  tick:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.3
rounded:
  tag: "4px"
  control: "6px"
  panel: "8px"
  overlay: "12px"
  avatar: "5px"
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
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 12px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    height: "36px"
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
  pill-brand:
    backgroundColor: "{colors.series-tint}"
    textColor: "{colors.brand-text}"
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
    height: "36px"
    padding: "0 8px"
  nav-item-active:
    backgroundColor: "{colors.series-tint}"
    textColor: "{colors.brand-text}"
    typography: "{typography.dense}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 8px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.dense}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 10px"
---

# Design System: AsoBeast

## Overview

**Creative North Star: "The Morning Standings"**

AsoBeast is opened once a day, after the daily run, to learn what moved. The system is built for that glance: one calm page of panels on a warm neutral ground, a single orange that belongs to the brand and to the data alike, numbers set in tabular figures that line up like a standings table, and change always written beside its value with a sign or an arrow in the direction colour. It sits at the finish level of Vercel, Plausible, Linear and Adapty, which the owner named as the bar, and it is the category standard played straight rather than a theme: a visitor who has used any of those products knows where everything is before they notice the colour.

The old look is the anti-reference. It boxed every section in the same card with a grey sentence under its title, repeated a pill for every attribute, put an icon beside every heading, spread text over two sizes and used the brand orange, blue, amber and a mono face at once. This system replaces that with a short type scale, panels only where a block is an object, pills only for a change or a state, icons only where a row needs a type glyph, and one accent family.

**Key Characteristics:**

- One sans face, Geist, with tabular figures everywhere a number can be compared.
- One hue family for the brand and the data: the brightest shade on the single primary button, a darker text shade for what is selected or yours, a deeper shade on chart lines and marks, the palest tint behind inline bars and a selected item.
- Green and red mean direction and nothing else, and never travel without a sign, an arrow or a word.
- Flat panels with a hairline border on a warm neutral ground; no shadow below an overlay.
- A metric strip that drives one chart, a sentence that says what moved, lists with inline bars, tables at 44 px.

## Colors

A warm neutral ground with one orange family and two signal hues, mirrored in a dark theme that is one step lighter per layer rather than a shadowed one.

### Primary

- **Brand Orange** (#f89820): the fill of the one primary button in a view and of a checked checkbox or switch (with a near black check or thumb), and in the dark theme the brand text, the brand mark and the chart series. In the light theme it is never text on a surface (2.1:1 on white).
- **Brand Text** (#a8520a light, 5.4:1 on white and 4.7:1 on the brand tint; #f89820 dark, `--brand-text`): text and icons that mean selected or yours: the active sidebar item and a `brand` pill. Orange text is only ever this shade.
- **Brand Mark** (#d2700a light, 3.5:1 on white; #f89820 dark, `--brand-mark`): marks of 2 px or more that need 3:1, not 4.5:1: the active metric tab and line tab underline, an unread or new dot (Alerts, the Discovered tab, What's New, the latest release), a progress bar or ring, and a link's underline on hover. It is also the chart series, sparklines and the end dot in the light theme, where the brand shade is too light to read as a line.
- **Brand Tint** (#fbeedb light, #2b2114 dark, `--brand-subtle`): the background of the active sidebar item and of a `brand` pill (the own app's row in the search results carries a 3 px brand mark start bar instead, so its You pill stays visible); inline bars behind list rows use the same tint (`--chart-tint`).
- **Previous Period** (#cdc8c0 light, #3d3933 dark): the comparison line under the series; always thinner and never filled.

### Secondary

- **Information Blue** (#1d4ed8 light, #60a5fa dark, `--info`): reserved for the chart system and the subtitle match mark (`MatchedText`), never a tag, a dot or text. The second series of a multi series chart is the brighter #2563eb (#60a5fa dark). An informational pill (`info`, the Essential tag) is ink on surface 2, not blue.

### Signals

- **Up** (#137a3a on #e4f5e9; dark #4ade80 on #0d2a18) and **Down** (#c2272d on #fde6e6; dark #f87171 on #3b1414): the direction of a change, as a pill or as coloured text with a sign. Up means better, so a position that fell from 14 to 6 is up.
- **Warn** (#7c6200 light, 5.8:1; #e8c34a dark, 10.9:1): a yellow amber, never orange, so a warning never reads as the brand: the word "High" in a priority column, a stale check and the weak grade; never a fill. **Critical** uses the down red.

### Neutral

- **Page** (#faf9f7 light, #0c0b0a dark): the ground every panel sits on.
- **Surface** (#ffffff light, #141311 dark): panels, the sidebar, the top bar, table rows.
- **Surface 2** (#f4f2ee light, #1c1a17 dark): the segmented control track, a hover row or sidebar item, a flat pill and an informational pill.
- **Line** (#e7e4df light, #2a2724 dark) and **Line 2** (#eeebe6 light, #221f1c dark): panel borders and header rules, then the lighter divider between rows.
- **Ink** (#1c1917 light, #efece7 dark), **Ink 2** (#6b665f light, #a39d94 dark) and **Ink 3** (#716b64 light, #8a847b dark): text, secondary text, and labels, captions and axis ticks. Every pair passes 4.5:1 on its surface in both themes.

### Named Rules

**The One Family Rule.** The brand orange and the data orange are shades of one hue, and the one accent of a screen: spent on action (the primary button, a checked control), selection (the active sidebar item, the active metric or line tab), ownership (a `brand` pill: Default, Detected, You, Yours, Latest, Next), unread dots and progress. Everything else is neutral, and status keeps its own hues: a warning is yellow amber, never orange, and a spinner turns in ink 2.

**The Direction Only Rule.** Green and red appear on a change, a signal or a critical word, and on nothing that is merely a category. Grades are words with a quiet marker, never a painted column.

**The No Blue By Default Rule.** Blue is held in reserve for a second chart series, chart markers and the subtitle match mark. It is never a tag, a dot or text, so it never competes with the orange (`styles/utility-classes.test.ts`).

## Typography

**Display Font:** Geist (with -apple-system, Segoe UI, sans-serif)
**Body Font:** Geist (same face)
**Label/Mono Font:** none; identifiers that need a monospace use the system monospace stack, and a number never does.

**Character:** one neutral grotesk at a short scale, with weight doing the small steps and size doing the two big ones. Numbers use the face's tabular, lining figures (`font-variant-numeric: tabular-nums`) wherever they can be compared. Geist is the face of one of the products set as the bar; it is widely used, which is accepted here as a brand commitment.

### Hierarchy

- **Hero** (600, 36px, 1.1, -0.024em): the billing wall's heading and plan prices from `sm` only; no signed in screen uses it.
- **Title** (600, 24px, 1.2, -0.02em): the page title, once per page.
- **Metric** (600, 28px, 1.1, -0.02em): the value of a metric tab or a headline figure, with its delta pill beside it; at most one strip of them per page.
- **Dialog** (500, 17px, 1.25): the title of a dialog, sheet or confirmation, one step above the panels under it so the overlay reads first; the keyword in the keyword sheet's header included.
- **Heading** (600, 15px, 1.4, -0.006em): a panel or section heading, every section, one size.
- **Body** (400, 15px, 1.45): the lede sentence, action titles, dialog text; prose keeps to 70ch.
- **Dense** (400, 14px, 1.45): table cells, list rows, navigation, controls; the size a daily session reads for minutes at a time, so it never drops below 14 px. Names in a row take 500.
- **Label** (500, 13px, sentence case, no tracking): column headers, metric tab labels, pill text. The line under a page title is label size at the step's default weight in ink 2 (`META_LINE`).
- **Caption** (400, 13px): metadata lines and notes under a figure.
- **Tick** (400, 12px): chart axis ticks, sidebar group labels and the priority words.

### Named Rules

**The Five Sizes Rule.** A screen uses title, heading, body or dense, label or caption and tick, plus the metric size in one strip and the dialog size in an overlay's title. No raw `text-sm` or `text-base` in a primitive; every size is a named step.

**The Sentence Case Rule.** Labels and column headers are sentence case with no letter spacing; the old tracked uppercase label is retired.

**The Tabular Rule.** A number that sits in a column or beside another number is tabular, right aligned with its header, with one count of decimals per column and the unit in the header; dates and ids stay left.

## Layout

The shell is a 232 px sidebar on the surface colour with a hairline right border and a 52 px top bar that carries the breadcrumb, the run status and the command key. Page content sits on the page colour with 32 px side padding at desktop and the density gutter below `sm`, inside the existing width utilities (`page-wide` at 1600 px for the dashboard and overview, `page-full` for the keywords table).

Vertical rhythm is a 4 px scale: 24 px between the page header and the first panel and between panels, 12 px between a panel header and its rows, 8 px inside a list, 16 px of horizontal padding in a table cell and a panel header. A panel header is at least 47 px tall with its 15 px heading centred and a hairline below; a panel footer is 12 px over and under in caption size and ink 3.

Sections are separated by space and panel edges, never by a tinted band. Two column areas split a 12 column grid 7 to 5 once the content box reaches 64 rem and stack below; the dashboard and the overview size their grids by container queries (`@container/dashboard`, `@container/overview`) so the sidebar's width is not a proxy for the content box. At 375 px the metric strip becomes a two by two grid, the page header's controls wrap under the title, the Apps table drops to app, visibility and 7d, lists keep their bars, and the top bar keeps only the breadcrumb, search, the health dot, the theme toggle and the account.

### Named Rules

**The Object Rule.** A panel exists only around a block that is an object: a metric strip with its chart, a list, a table, the action queue. Headings, sentences and a lone figure sit on the page.

**The Two Densities Rule.** Lists are 36 px rows, tables 44 px with a 36 px compact option, navigation and controls 36 px. Nothing in the shell is taller than 44 px except a chart.

## Elevation & Depth

Flat by default. A panel is a surface with a 1 px line on the page colour; the dark theme conveys the same hierarchy with a surface one step lighter than the page and a lighter line, never a shadow. Hover is a surface step, selection is the surface 2 tint plus a 2 px inline start bar in ink, so a selected row can be told from a hovered one.

### Shadow Vocabulary

- **Segment** (`0 1px 2px rgba(0,0,0,0.06)`): the raised pill of a segmented control, the one shadow in the shell.
- **Overlay** (`0 8px 24px rgba(0,0,0,0.12)` light; `0 1px 0 rgba(255,255,255,0.06) inset, 0 12px 32px rgba(0,0,0,0.6)` dark): menus, popovers, dialogs and sheets.

### Named Rules

**The Flat Page Rule.** No shadow below an overlay. A flat container carries a line or a tint, never both plus a shadow.

## Shapes

A restrained radius scale by role: 4 px on tags and checkboxes, 6 px on buttons, inputs, pills, segmented controls and list row hover, 8 px on panels and the table frame, 12 px on menus, popovers and dialogs. A child radius never exceeds its parent, and nothing in the shell is rounder than 8 px except an overlay. App icons are the exception by design: their radius is 22.5 percent of their size with a 4 px floor (4 px at 16, 5 px at 24, 7 px at 32), so they read as store icons. Borders are 1 px hairlines in the line colour; the metric strip divides its tabs with vertical hairlines and marks the active tab with a 2 px brand mark underline on the panel edge.

## Components

### Buttons

- **Shape:** gently rounded (6 px), 36 px tall with 12 px side padding, dense size (14 px) at 500; `lg` is 40 px, `sm` 28 px in label size, `xs` 24 px, an icon button 36 px from `md` and 32 px below.
- **Primary:** brand orange fill with near black ink (#1c1408), one per independent task in a view; hover darkens the fill one step. A trigger that only opens a dialog is outline, never primary.
- **Outline:** surface fill with a hairline border, hover to surface 2; **Ghost:** no border, ink 2 text, hover to surface 2 and ink; **Link:** see Links. A control that starts a request stays focusable with `aria-disabled` and dims; it is never `disabled`.
- **Focus:** a solid 2 px ink ring everywhere, offset by 2 px from a filled control (the primary button, a checked box, a switch); nothing translucent. An orange ring is about 2:1 on the page, so the ring is never orange.

### Pills

- **Style:** 22 px tall, 6 px radius, label size at 500, tinted fill with its own text colour. Variants: up (green), down (red), flat (surface 2 with ink 2), and the state words Paused and Checking in flat.
- **Use:** a change (the delta beside a metric, the 7d column, the Change column, an alert's kind of move), a count that is a state (`1 critical`), a state that changes, an insight (Beatable, Dropping), or ownership in a change feed (yours, competitor). Ownership of a state is the `brand` pill (brand tint, brand text): a localization's Default role, a Detected localization, You in the search results, Yours in top charts, the Latest release and the Next checklist step. Further variants carry status tints: success, warning and destructive; `info` is ink on surface 2 (the Essential alert tag). Never a source, a store, a market, a tag or a category, which are text; never a pill that would appear on every row of a list. A localization's read role is a pill on every screen (`ReadRoleBadge`): Default in `brand` and Also flat, prefixed with the market where several markets read one localization (`US · Default`). A new entrant in a search results or chart list is the word New in the up colour, as the delta beside it is coloured text.

### Change and delta

Four forms exist, each in `components/ui/delta-chip.tsx` or beside its list, and each pairs the direction colour with a glyph, so colour is never the only signal.

- **Trend chip** (`TrendChip`): a signed figure with an up or down arrow and its period, `+5 7d`, `-0.05 7d`, `+3 30d`. As a pill (22 px, tinted) it sits beside a metric value and in the Apps table's 7d column, where the period moves into hidden text; as text it is the metric tab's second period note (`-3 30d`). Higher is better; zero is ink 2 with a flat mark.
- **Delta chip** (`DeltaChip`): an arrow and an unsigned magnitude, for positions, where the arrow already says the way and lower is better. The keywords table's Change column draws it as a pill (`↑ 2`), with the words Lost and New; its accessible name is `up 2 since yesterday`.
- **Position delta** (`PositionDeltaChip`): the same arrow and unsigned magnitude as label size text without a pill, beside the Last 7 days line.
- **One arrow:** every change uses the same up and down arrow (`DirectionArrow`, the glyph of the chips above). Movers lists write it before the magnitude in the direction colour, `↑ 8`, `↓ lost`, `↑ new`; the dashboard's Moved tab carries it in up and down pills, and the Apps table's Moved column as coloured arrows before plain counts, `↑3 ↓1`. The arrow is hidden from assistive tech and the change is named in words.

### Links

- A link is ink text with a 1 px underline in ink 3 offset 4 px, which turns to the brand mark on hover, all held by the `link-underline` utility (`FOOTER_LINK`, the `link` button and badge variants use it too). The text is never orange and never blue. A panel's footer link sits at its right.

### Page header

- A page opens with its title; an app page sets the 32 px store icon beside it with store, home storefront and the store page link on one label size line under it. The line of facts under a title (`META_LINE`, label size in ink 2) joins its parts with a middle dot: counts and run state on the dashboard, version, price and snapshot day on the overview. A daily page adds the lede (`LEDE`, body size in ink 2, 70ch) with its figures at 500 in ink.
- `PageHeader` (`components/layout/PageHeader.tsx`) draws it: the title, the controls at the right with the one primary last, then the lede and the facts line. A page under the app band passes `titleHidden`, which keeps its name as a visually hidden `h2` under the band's `h1`, and opens with its control row instead of a second visible heading.

### Collapsible sections

- A section the viewer can fold (`CollapsibleCard`, or `SECTION_TOGGLE` with `SECTION_CHEVRON`) is a panel whose `h2` title is the trigger: the title, then a 16 px chevron in ink 2 beside it that points right while closed and down while open, turning in 150 ms. Hover underlines the title in ink. Header controls stay visible while closed, so a closed section is one line: its description is the first line of its open content, and an info tip sits at the right of the header. Closed content is not mounted.

### Priority words

- `PriorityWord` (`components/actions/PriorityWord.tsx`): Critical in the down red, High in warn, Medium and Low in ink 2, as 12 px uppercase words at 600 with wide tracking in a 64 px column (`PRIORITY_COLUMNS`) before the action title, with the app named on a caption line under the title on the dashboard. They are the one uppercase label in the system, because a priority is read as a mark, not a word.

### Panels

- **Corner Style:** 8 px.
- **Background:** surface, with a hairline border; the header is at least 47 px tall with 16 px side padding, the heading at the left and a count in label size and ink 3, a segmented control or a range control at the right; a footer line in caption size and ink 3 says what the panel reads or over which window, with its link at the right.
- **Shadow Strategy:** none (see Elevation).
- **Internal Padding:** 16 px in headers and table cells, 8 px around a list so its 36 px rows can carry a hover and a bar.
- **Full bleed:** a table or list that runs edge to edge in a panel sits in `CardContent` with `PANEL_BLEED`, which cancels the panel's side and vertical padding, and draws no frame of its own: never a bordered table inside a bordered panel.

### Metric strip

- The first panel of a page: four metric tabs divided by hairlines, each a pressable button with a label, a 28 px value with its trend or count pills on the same line, then a one line note in caption size and ink 3. The active tab carries a 2 px brand mark underline and decides, through the URL, what the chart in the same panel shows; the chart's own title and range control sit on a row above the plot. On a phone the strip is a two by two grid.
- `MetricStrip` (`ui/stat-tile.tsx`) draws every strip and lays out by its own width: four columns from 768 px of strip width (two by two below), three from 512 px (one below), or two. Unframed (`framed={false}`) it heads the panel that holds its chart; framed, the default, it is a bordered panel of its own. A tile is a tab (`onSelect`) only where it drives the chart below or a URL filter, otherwise a static figure, and its `delta` (a trend pill or a state badge) sits beside the value. `MetricStripSkeleton` draws the same geometry while it loads.

### Charts

- One area or line chart per panel, 268 px tall at desktop and 200 px below `md`, drawn through the chart system in `components/charts/theme.ts`; the keywords map is 360 px (300 px below `md`). The series is the data orange at 2 px; the previous period is the previous grey at 1.5 px; the fill is a 16 percent to 0 vertical fade of the series; the grid is horizontal hairlines in the line 2 colour with 12 px ticks in ink 3; the axis has no line. A day whose checks are still running is a dashed segment that ends in a hollow dot; a listing change is a dashed vertical line in ink 3. The key (`ChartKey`) is label size in ink 2 with a short swatch per series, right aligned above the plot, or in a row under it beside a footer link when the chart carries change markers; never inside the plot. Lines are monotone; integer counts use step interpolation. Rank charts keep the reversed square root axis and draw rank bands as one orange ramp of five tints with unranked in surface 2; a multi series chart uses the eight colour series palette (orange, blue #2563eb, teal #0f766e, violet #7c3aed, rose #db2777, grey #6b7280, umber #8a5a2b, olive #5f6b1f) with eight dash patterns in the same order, and a legend in band or rank order. A sparkline in a table is 72 by 22 px, the series colour at 1.5 px, no fill, no axis. The trend on a dashboard app card is the one exception: 48 px tall across the card, a 2 px line in the direction colour (up green, down red, flat ink 2) over a 12 percent fill of the same colour, with an end dot.

### Breakdown lists

- A panel of 36 px rows (40 px below `sm`) under label size column heads in ink 3: a 16 px app icon, the keyword at 500, a market code in ink 3, on the overview a 30 day sparkline, then the position move as `14 → 6` with the new position at 500, and the change. Behind the name a bar in the series tint whose width is the size of the move, capped at 20 positions and reaching at most 60 percent of the row, so the eye reads magnitude before the number. The change is the arrow and magnitude in the direction colour; new and lost are words after their arrow. All, Climbers and Fallers sit in the panel header as a segmented control.

### Tables

- The table kit, 44 px rows with 16 px cell padding from `md` (8 px below), 36 px header rows with 13 px sentence case headers in ink 3 over a hairline, 14 px cells, no zebra, a lighter line between rows, hover to surface 2. Numeric columns and their headers are right aligned and tabular; a name cell holds a 24 px app icon, the name at 500 and a 12 px ink 3 line under it. The keyword table keeps 44 px rows, right aligns its score columns, shows change beside position, fits its default columns inside its frame from 1280 px (its cell padding steps from 12 to 10, 8 and 6 px as the frame narrows) and keeps a slim meter under each score. A totals footer repeats the header style and counts: keywords, ranked, not ranking, in the top 10, moved up, moved down.
- Facets sit behind one **Filters** control (`data-table/FiltersControl.tsx`): a popover from `md` and a bottom sheet below it, both a dialog named Filters, with the active count as a flat pill on the outline button. A renderer reads a column's numeric flag with `numericProps(column)`.

### Navigation

- The sidebar: the mark and the product name at 14 px 600, a workspace switcher as an outlined 6 px control, then 36 px items at 14 px in ink 2 with an 18 px lucide icon, hover on surface 2 in ink, the active item on the brand tint with its text and icon in brand text; a count sits at the right. Workspace and App are 12 px group labels; What's New, Documentation and the version sit at the foot. The top bar is 52 px on the surface with the sidebar toggle and breadcrumb at the left; on an app page the run status, Refresh and Run daily sit at the right, then search, the API health dot with its word, the theme toggle and the account. The health badge keeps only its mark below `sm`.

### Inputs and selects

- 36 px tall, 6 px radius, hairline border, surface fill, 14 px text (16 px below `md`, so a phone does not zoom); a select shows a 16 px calendar or chevron icon and opens a 12 px radius menu. Focus is a 2 px ink ring. The segmented control is a surface 2 track with a raised surface pill for the active option; it carries counts (`Tracked 5`, `Moved 2`) in ink 2 after the word.

### App icons

- The store's own icon at 32 px beside an app page title, 24 px in a table and 16 px in a list, with the radius ratio under Shapes. The fallback is a neutral silhouette on surface 2, never a letter tile.

### States

- **Loading:** skeleton blocks in surface 2 at the real geometry; the pulse stops under reduced motion; a loading region announces itself.
- **Empty:** one sentence saying what is missing and the one action that fills it, centred inside the panel, no icon and no box (`EmptyState`). A chart's empty and insufficient states (`ChartNotice`, `ChartStat`, `RankingStates`) are the same sentence and action, centred at the chart's real height; the dashboard's first run and a page that is not found centre their title, sentence and action in the page column.
- **Error:** the shared error state; a secondary section uses the inline query error.
- **Stale and checking:** a 16 px clock with the day of the last check in label size; **Checking…** with a 14 px spinner; a found nothing position reads ">200" in ink 2 with "was #14" in tick size under it.

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
- **Don't** use orange for a warning, a data bar on another page or a resting link underline, or the bright brand shade for text on a light surface.
- **Don't** colour a position or a score by grade; show the grade word with a quiet marker: a filled dot for strong, a half filled one for weak, a ring for poor, none for fair.
- **Don't** draw a sparkline fill (the dashboard app card's trend aside) or a shadow below an overlay. A meter under a number belongs to the keywords table only, where the owner asked for it.
- **Don't** use uppercase tracked labels, a second typeface, or a monospace face for numbers.
- **Don't** render a letter tile where an app icon belongs.

## Screens

The per screen intent for each signed in page; the components above supply the parts. Each page's subsection describes it as shipped.

### Dashboard

Page title "Dashboard" with the range select (a calendar icon, `Last 30 days`) and the primary "Import app" at the right. Under the title the lede sentence, `In the last 30 days 4 keywords climbed and 3 fell across 3 apps`, with the counts at 500 in ink, then the status line: apps, keywords and competitors counted, when the data was collected, the run state and the share of the daily request budget used. Metric strip: Visibility, Keywords in top 10, Moved in the range (its total with up and down arrow pills), Open actions (with a critical pill), each tab choosing through `?metric=` what the chart in the same panel draws, with the previous period under it. Then Keyword movers (All, Climbers, Fallers) beside Do next, five priority rows each naming its app, store and market under the title and an Action Center link in the footer. Then the Apps panel: a table by default (app with store, market and keyword count, trend sparkline, visibility, 7d, in top 10, moved, rating, open actions, a row menu) with Columns and a table or cards toggle in the header; the card view lays the same apps out as cards. An app with no history reads "Not enough history" in the trend cell. Then Listing changes (All, Yours, Competitors; a version run collapsed to one row) beside Alerts for the last 7 days.

### App overview

The app header: the 32 px icon, the name as the title, store, home storefront and the store page link on a label line, and "Link store listing" at the right. Then the facts line (version, price, snapshot day) at the left and the Market select (with All markets) and the Print report outline button at the right. Metric strip: Visibility, Share of voice, Keywords in top 10, Rating, each with its trend pill and note; the selected tab is held in `?visView=` and draws its own chart in the same panel, with the chart's title, an info tip and the range picker (30d, 90d) on a row inside the panel, change markers for listing changes, and the key with "See what each change did" under the plot. The rating chart is the home listing's and ignores the market. Then Keyword movers, with a Closest to the top 10 list and a footer naming the winnable gaps, beside a column of Do next and Metadata coverage (per field bars in the series tint, the strongest keyword missing from the metadata, a link to the discoveries). Then the Store funnel as a second figure strip (impressions, product page views, get taps, conversion) with 28d pills, 7d notes and sparklines, and a footer naming the source and window. Then Category ranks (7d, 30d, 90d) beside Ratings by market, a collapsible table; with a single listing the category chart takes the full width.

### Keywords

The app header as on the overview, then one row: the Tracked and Discovered segmented control with counts (an orange dot marks unseen discoveries), the market select with the keyword count of each market and an outline icon button to add a market; at the right the Map toggle (Tracked only), Import CSV as an outline button and the primary "Add keywords". Under it one sentence: how many keywords are tracked and active, and how many climbed and fell since yesterday. Then the table's own row: search, one Filters control (a popover from `md`, a bottom sheet below it) with its active chips under it, the All, Moved, Fell and Lost switch with counts, the shown count, Columns and Export CSV. The table keeps 44 px rows with Keyword (listing marks as tinted underlines, the class as a 4 px tag, Paused as a flat pill), Position as a chip (tinted for the top 3, outlined for the top 10), Change as a delta pill with the words Lost and New, Last 7 days as a position line with its position delta, then Opportunity, Popularity and Difficulty each as a number over a slim meter in the grade colour, up to two Insight badges and the Top apps column of three overlapping store icons in one button with a bar under the own app; Tags, Source, Volatility, Added, Competitors in top 10 and Reveal are hidden by default, one row menu stays pinned at the right edge, and the default columns fit the table frame from 1280 px: a narrower frame shortens the keyword and folds the second insight into a count, then drops the 7 day line and tightens the cell padding, then hides the sort arrows of unsorted headers. A lost ranking stacks `was #14` in tick size under `>200`, so the Position column keeps one width. The totals footer counts keywords, ranked and not found, the average position and the top 10, the moves of the day and of 7 days, beside the three averages. Under the table the market's search read is a collapsible panel of localizations, notes and a closed line for localizations not shipped. The Discovered tab puts its search first, then the All, Ranked and Opportunities tabs with counts, then the Auto-track ranked switch and the Refresh discoveries, Track recommended and Track all ranked outline buttons, then the discovered table (keyword with its recommendation, source, position chip, the three scores and relevance over meters, a Track button and a dismiss icon per row) with a footer naming the last check and the weekly budget. Suggestions and Keyword combinations sit under it as collapsible panels, one title line while closed, opening on their one sentence description; the combinations info tip sits at the right of its header. The cross store note lives in the Popularity header's info tip.

### Action Center

Page title "Action Center" with Generate now as an outline button at the right, because the primary of the page is the next step of the top action. The lede says what the day of the last run opened and closed, `On the day of the last run 1 action opened and 1 was closed by you`, and the facts line names when the queue was generated and how many findings the per app cap withheld. On an app's page the app header stands in for the title and the same lede opens the page. Then a framed strip of four static figures: Open, New this week with its change against the week before as a flat pill, Confirmed fixed and Snoozed; flow counts are never green or red, because more work arriving is not a direction, and Open carries no change, because snoozing and waking move it without an event to count. Beside the rail, **Start here** is a panel of the highest impact open action in the to do list: its priority word, headline, the app and its evidence sentence, the impact figure, the numbered steps with the confirmation step in ink 2, and the primary "Fix it in Metadata" beside Done, Snooze and "See the evidence". The toolbar sits on the page above the queue: search, one Filters control (rule, category, app, market, store), Group and Sort, then the four priority toggles and the shown count. The **Queue** panel carries the status switch in its header, a column head (Priority, Action, Impact), group sub-headers with their checkbox on a hairline, and two line rows: checkbox, the priority word in its 64 px column, the headline at 500 as the link that opens the sheet, then the app icon, name and market code with the reason in short form and its leading figures at 500, the state at the end (Snoozed until, Reopened and Verifying as flat pills, Confirmed fixed in the success tint, Evidence unavailable and Still detected as a word in warn), the impact figure, Done and one row menu. The row open in the sheet takes surface 2 and the 2 px ink start bar, a checked row surface 2, and keyboard focus the ring. Below 672 px of queue width a row is one 44 px control line (checkbox, priority, impact, Done, menu) over the headline and a wrapping reason. The footer counts what is loaded, names the keys and links Shortcuts and the guide. The rail holds **Progress**, the dashboard's diverging bars of opened above and closed below with the key in the header and the 30 day totals in the footer, and **Where the work is**, a breakdown list switched between App (Market on an app's page) and Type, each row a link that filters the queue, with a series tint bar sized by its share of the open work and the critical and high counts as priority words. The first visit replaces the queue with three numbered sentences on how it is made and Generate now as the one primary.

### Alerts

Page title "Alerts" with "Alert settings" as a text link at the right and no primary. Under it the lede counts the loaded events after the viewer's last visit, `3 new since your last visit`, with the count at 500 in ink; it reads "Nothing new since your last visit" when all were seen, "50 or more new" when the whole first page is new and another page exists, and the count of the window on a first visit. No metric strip: the feed carries no totals. Then the toolbar on the page: search, the App and Event type facets and the shown count at the right, with the active chips under it. Then one panel for every event of the last 30 days. Each UTC day is a region whose heading is a 36 px sub-header on a hairline, the day in ink and its count in ink 3. A row is a bare 16 px type glyph in its tone (red for a loss, green for a gain, ink 2 otherwise), the sentence at dense size and 500 as the link, which takes the hover and the click of the whole row, **New** as the information pill after the sentence, then the 16 px app icon with the app, store and market in caption size, a size pill and the UTC time in label size and ink 3 as aligned columns. The size pill appears only where the event measures a move: the positions a keyword or a chart rank moved (`↓ 8`, `↑ 13`) and the stars a rating fell (`↓ 0.2`). The row lays out by the width of the page column (`@container/alerts`): one line of 36 px from 56 rem, the app caption under the sentence below that, and under 42 rem the sentence on up to three lines over the app, the storefront code and the time, with New and the size at the right of that line. The footer says what the panel reads, links "How alerts work" and holds Load more as a small outline button; a failed page and the end of the window are said there. Empty states sit centred in the panel: nothing recorded yet with Open Settings, no match with Clear filters.

### Rankings

The app header, then one row: the Report markets select with the keyword count of each market and an All markets item, and the Print report outline button at the right; no primary on the page. Under it the lede: how many keywords the market tracks, what climbed and fell since yesterday, and how many apps entered a top 10 in the entrants window. No metric strip: the chart plots a chosen set of keywords, not one figure. Then the Keyword positions panel beside a side column, 8 to 4 once the content box reaches 64 rem (`@container/rankings`). Its header holds the keyword picker (`5 selected`), the Chart and By day switch (`?view=days`) and the 7d, 30d, 90d range; the controls stay mounted while a new range or selection loads and only the body shows its skeleton. Chart view: the marks key (Listing change, Annotation) right aligned above the plot, the rank chart at the hero height with the band ramp, then the key as a compact table that replaces the legend: each row is the line pattern swatch, the keyword with its market code in ink 3, the newest position (`>200` in ink 2, a clock and the day when its checks stopped earlier), the change across the range as a delta chip or the words New, Lost and Not ranked, the best and the average position, and a ghost remove button that hands focus to the next row. By day view: the same keywords as rows over one column per checked day, newest first, each position in a cell tinted by rank band from the same ramp, `>200` on surface 2 and a dash for a day without a check, with the band key above the grid and the keyword column pinned while it scrolls sideways. The footer says the depth and the last check and holds Export CSV, Copy image and Download PNG as small outline buttons. The side column: New in your top 10 (7d, 14d, 30d; each day a sub-header with its count; rows of the app name at 500, the keyword and position in ink 2, Competitor or You as an ink 3 word, Track as a small outline button; the footer names the market and the window; the empty state offers the 30 day window) and Annotations (rows of the date, the label at 500, tag and market as ink 3 text and a ghost delete; Add annotation is an outline button that opens the form in a popover). Printed, the controls drop out, the range prints as words and the key table prints under the chart.

### Competitors

The app header, then the lede with no controls: how many competitors are tracked, with the count at 500 in ink, and the newest listing change one of them made in the last 7 days, `1 competitor tracked. Rival Focus changed its subtitle on Nov 10.` Every block is a collapsible panel. From 64 rem of page column the first two sit 7 to 5 (`@container/competitors`). **Track the apps you rank against** holds the add field with the page's one primary, Add competitor, then 44 px rows: the 24 px icon, the name at 500, a caption line in ink 3 (`★ 4.5 (12,000) · Free · v2.1.0`), Delisted as the warning pill and a ghost remove; the header carries the count (`1 tracked`) and Export CSV, the footer says when a new competitor gets positions. **How you compare** is a breakdown list of the own app (a `brand` You pill) and every competitor by visibility, each with its rating and a series tint bar the length of its visibility inside the name column; its header switches it to Listing text, each app's title and subtitle with their character counts against the store's limit, red when over. **Where competitors beat you** keeps the info tip at the right of its header; its lists are a segmented control with counts beside the market select, then search, the shown count, Columns and Export CSV, then the table full bleed with right aligned figures, their and your position as the keywords position chip, the three scores with their grade markers and a footer naming how many keywords were compared in how many markets. **Apps you don’t track yet** has the window segment in its header, the 24 px icon with the name and developer, the keyword count as a button that opens the keywords in a named popover, the best position as a chip, and a footer naming the store and the window. **Your position against every competitor** has the Only gaps switch in its header; a gap row carries a flat Gap pill and no tint, the You column sits on surface 2, the best position of a row is underlined, a competitor's header is its icon beside its name up to three competitors and over it from four, and a totals row counts the keywords shown, those of the own app in the top 10 and, under each competitor, the keywords led and trailed. On a phone the gap table shows keyword, their position and your position, the lists scroll sideways and Add competitor sits under its field. Empty panels centre one sentence and its action.

### Reviews

The app header, then the lede with no control row above it: how many reviews arrived since yesterday (and how many of those at two stars or less), how many need a reply and the rating with its move over 7 days, the counts at 500 in ink; it reads "50 or more" when the whole first page is new and another page exists. Then a main column beside a side column, 8 to 4 once the content box reaches 64 rem (`@container/reviews`); below that the side column follows the main one, so the page reads ratings, reviews, distribution, versions, mentions in the order of its markup. The ratings panel is an unframed strip of two tabs, Rating (the average, its 7 day pill, the count it averages) and Ratings (the count, the ratings gained in 7 days, the gain since the first day of the range), held in `?ratingsView=`, over one single axis chart with its title and the 30d, 90d, 180d range on a row above the plot: the average as the overview's rating line on a fitted axis, the ratings as bars of the ratings gained between daily reads, never below zero. With fewer than four reads either chart shows its latest figure instead. The **Reviews** panel carries the reply status switch with counts in its header (All, Needs reply, Draft, Replied, and Updated when a review changed after its reply) with the info tip beside it, then a toolbar inside the panel: the five star toggles as one joined outline group pressed to the accent tint, the version, date and sort selects, the search, and Reply guidelines and Export CSV at the right. A review is a row, not a card: the stars as an ink glyph run with empty stars in ink 3, the title at 500 and the reply state at the right as caption text with a quiet marker (a ring and 500 ink for Needs reply, a half filled dot for a draft, a filled dot for replied, the word in warn when the review or the reply changed afterwards, a dashed ring while a post is pending); the text at body size, clamped to four lines; a caption line of author, day and version with Translate and the outline Reply at its end. No red stars, no red rule and no version pill. The open composer sits in its row, which takes surface 2 and the 2 px ink start bar, with no box of its own. The footer says how many are shown of how many and in which order, or how many match the search, with Show all at the right. The switch moves by arrow keys and filters on Enter or Space, because Needs reply also changes the sort. The side column holds three breakdown lists with series tint bars capped at 60 percent of the row: **Ratings distribution** (stars, ratings, share; the footer names the total, the day it was read and the share at two stars or less; hidden when the store gives no histogram), **Rating by version** (the count and the graded average of the loaded reviews per app version, each row a pressed button that filters the list by that version; the footer says when it reads only the newest reviews) and **What people mention** (complaints and praise under their own sub-headers, each row a pressed button that searches the list for the phrase, the info tip at the right of the header). A pressed row takes surface 2 and the ink start bar. With nothing stored the side column is absent and the main column takes the full width.

### Top charts

Page title "Top charts" with Followed charts as an outline button and the primary "Follow category" at the right; in the table view Capture today sits between them. The lede says where the own app stands and what moved, `Word Garden holds #3 in Free, unchanged since Nov 11. Across the three charts 18 apps climbed, 8 fell and 2 entered.`, counted over every captured place; with no own app listed it says so, and an uncaptured category says that instead. Then the toolbar on the page, unchanged: store, country, category, the captured day, the comparison window and the layout switch on one row, or the day and a Filters sheet on a phone. **Your apps and competitors in** the category is a table panel shown only when a tracked app is listed: the 24 px icon and the name as the link to the app, Yours as the `brand` pill with the 3 px brand mark start bar or "Competitor of" the own app in ink 3, then its place in Free, Paid and Grossing with the change before it (`>` and the capture depth in ink 2 when the capture does not list it, `>100` on the App Store and `>200` on Google Play), and for an own app on its home storefront the 30 day line of its stored category rank; the footer says the places are read from the whole capture. Then three panels, one per chart, each a region: the heading with the count at the right (`10 apps`, `Top 25 of 100`), a movement bar under the header (a 6 px bar split into climbed in the up colour, new in a lighter green, held in the line colour and fell in the down colour, with the four counts as words under it), then 36 px rows of the position in ink 2, the 16 px icon, the name at 500 and the change as an arrow and a figure, New as the up word. The own app's row carries the Yours pill and the start bar; a competitor's the word Competitor in ink 3 (its link is named in full). Add as competitor and Open in the store sit before the change and appear on row hover or focus from `md`; they are always visible on touch and below `md`. The footer names when the chart was captured and holds Capture today as a small outline button and Open table. **Trending since** the comparison day follows as one panel: the chart kind switch in its header, the Climbers, New, Fallers and Dropped out switch with counts (Dropped out reads Out where the panel is narrow), 36 px rows with a series tint bar sized by the move and capped at 20 places, the move as `12 → 8` and the change. The table view puts one chart in a panel beside the sticky Trending panel: the Table and History switch in its header (`?tableView=`), the search, shown count and Columns inside the panel, the table full bleed with right aligned # and Change, a 24 px icon with the developer under the name, Price as text and the start bar on the own app's row, and a footer naming the count, the capture time and the comparison day. History draws the top ten of the shown day across the last seven captured days as a rank chart on the reversed square root axis from 1 to 10: the own app as the solid series line, the others as the previous period line in the chart system's dash patterns, each with a hollow dot per captured day and its name at the end of its line, a break on a day the app was outside the top ten; with fewer than four captured days it says so. An uncaptured chart centres one sentence and Capture today in its panel.

### Metadata

### Changes

### Audit

### Settings

### Integrations

### Setup

### Keyword inspector

### What's new

## Where it lives

- **Tokens:** `src/styles/primitives.css` (raw values, both themes), `src/styles/semantic.css` (roles: background, card, muted, border, ink steps, signals, grades, chart series, elevation), `src/app/globals.css` (Tailwind theme mapping, radius scale, focus ring, reduced motion), `components/tokens/token-groups.ts` with `src/styles/tokens.test.ts` (the contrast pairs).
- **Type and width:** `src/styles/typography.css` (the steps, known to `cn` through `TYPE_STEPS` in `lib/utils.ts`, and the `numeric` and `link-underline` utilities); `src/styles/layout.css` (page widths, gutters, the keywords table width tiers).
- **Primitives:** `components/ui/` (button, badge, card, table, tabs, input, select, stat-tile, delta-chip, graded, meter, empty-state, skeleton, info-tip, sidebar).
- **Shared classes:** `components/layout/panel-classes.ts` (`LEDE`, `META_LINE`, `PANEL_HEADER`, `PANEL_BLEED`, `PANEL_COUNT`, `LIST_ROW`, `LIST_HEAD`, `FOOTER_LINK`, `SECTION_TOGGLE`, `SECTION_CHEVRON`), `components/layout/PageHeader.tsx`, `CollapsibleCard.tsx` and `feed-row.tsx` (the dated feed row).
- **Shell:** `components/layout/AppSidebar.tsx`, `SidebarNav.tsx`, `InsetHeader.tsx`; `components/AppIcon.tsx` with `app-icon-radius.ts`.
- **Charts:** `components/charts/theme.ts`, `ChartKey.tsx`, `ChartStates.tsx`, `SeriesFade.tsx`, `rank-layers.tsx`, `Sparkline.tsx`, `DivergingBars.tsx` with `diverging-trend.ts` and `trend-axis.ts`.
- **Lists and tables:** `components/rankings/MoversPanel.tsx` and `MoverList.tsx`, `components/actions/DoNextPanel.tsx` with `PriorityWord.tsx`, `components/data-table/` with `FiltersControl.tsx`, `lib/grade.ts`.
- **Screens:** `components/dashboard/`, `components/overview/` with `components/app-detail/AppHeader.tsx`, `components/keywords/` with `keywords/discovery/`.
