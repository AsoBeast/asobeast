import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const CATALOG = new URL(
  "../../packages/mcp-tools/dist/index.mjs",
  import.meta.url,
);

const {
  ACTION_TOOLS,
  APP_TOOLS,
  COMPETITOR_TOOLS,
  INSIGHT_TOOLS,
  KEYWORD_TOOLS,
  MCP_TOOLS,
  MCP_WRITE_TOOLS,
} = await import(CATALOG).catch(() => {
  console.error(
    "the tool catalog is not built, run pnpm --filter @asobeast/mcp-tools build first",
  );
  process.exit(1);
});

const CHECK = process.argv.includes("--check");
const OUTPUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "mcp",
  "tools.mdx",
);

const GROUPS = [
  {
    title: "Apps",
    tools: APP_TOOLS,
    note: "Start with `list_apps`. Nothing else works without an app id. Pass `country` to `get_app`, `metadata_audit` or `changes_timeline` to read one market's listing.",
  },
  {
    title: "Keywords",
    tools: KEYWORD_TOOLS,
    note: "Keywords are per market, so pass `country` to scope to one storefront. `strategy` chooses the suggestion source: metadata, search, similar, developer, competitors, seasonal or reviews.\n\nEvery parameter is validated by the tool before a request leaves, against the same bounds the API enforces. A `country` is a lowercase two letter storefront code, a date is `YYYY-MM-DD`, and a `limit` or `days` window is refused rather than sent when it sits outside the range the endpoint accepts.",
  },
  {
    title: "Competitors",
    tools: COMPETITOR_TOOLS,
    note: "Competitors belong to one primary app, so pass the primary app's id. `keyword_comparison`, listed under Keywords, puts the positions of the app and each competitor side by side, and `onlyGaps` narrows it to the keywords where a competitor leads.",
  },
  {
    title: "Insights",
    tools: INSIGHT_TOOLS,
    note: "`from` and `to` are inclusive UTC date strings in `YYYY-MM-DD` form. Omit `keywordIds` on `ranking_history` to get every tracked keyword, and omit `date` on `serp_snapshot` to get the most recent one. Omit `country` on `metadata_audit` and `changes_timeline` for the home storefront. `category_ranks` is the home storefront only and defaults to the last 90 days.",
  },
  {
    title: "Actions",
    tools: ACTION_TOOLS,
    note: "`status` defaults to `OPEN` and `SNOOZED`, and `limit` defaults to 100 with a maximum of 200. Actions exist only for tracked primary apps, never for competitors, which appear only inside evidence. See [Work the Action Center](/guides/action-center).",
  },
];

const TAIL = `## Reading the results

Two conventions matter more than the rest when an agent is interpreting output.

A position is 1 based, and \`null\` means the keyword was checked and the app was not found within that row's depth. Never read \`null\` as zero. See [Positions and rank depth](/concepts/positions).

Apple and Google Play scores come from different public evidence and are not comparable, so never rank one store's keyword against another's. See [App Store and Google Play](/concepts/stores).

## Every tool maps to an endpoint

Each tool wraps one route on the HTTP API, so the data an agent can reach and the changes it can make are exactly what that route allows and nothing more. Both transports read the same catalog, so the hosted endpoint and the local stdio server expose an identical surface for a given token. See [asobeast API](/api-reference/introduction).

## What is deliberately missing

No tool imports an app, edits metadata, writes the iOS keyword field, refreshes a listing, runs the daily pipeline, calls an AI feature or touches billing, tokens, webhooks or settings. Those either spend store capacity in bulk, spend your AI allowance, or publish a decision you should own. An agent proposes them and you decide.
`;

const CHANGES_NOTE = `\`track_keywords\` takes a \`country\` and defaults to the app's home storefront. It accepts up to 50 phrases a call, queues the same store scoring job the web app queues for each new phrase, and counts against the plan's keyword market limit, so it spends store request capacity. \`untrack_keyword\` and \`remove_competitor\` delete, and take the ids that \`list_keywords\` and \`list_competitors\` return. \`add_competitor\` fetches the listing from the live store before it answers. \`set_action_status\` takes \`snoozedUntil\` as a UTC date and an optional \`note\`, and the change is recorded in the action history under the name of the person who minted the token.

Every change goes through the same route, validation, plan write budget and quota as the web app, so a refused change reads the way the web app's refusal does. If a change fails with a server error, a timeout or an answer that cannot be read, it may or may not have been applied, and the message says so. Read the current state before retrying.`;

function optional(schema) {
  return schema.safeParse(undefined).success;
}

function parametersOf(tool) {
  const entries = Object.entries(tool.inputSchema.shape);
  if (entries.length === 0) return "None";
  return entries
    .map(([name, schema]) =>
      optional(schema) ? `\`${name}\`` : `\`${name}\` (required)`,
    )
    .join(", ");
}

function summaryOf(tool) {
  const [first] = tool.description.split(/\.\s|\s[—–]\s/);
  return first.replace(/\|/g, "\\|").replace(/\.$/, "").trim();
}

function tableFor(tools) {
  const rows = tools.map(
    (tool) =>
      `| \`${tool.name}\` | ${tool.title} | ${summaryOf(tool)} | ${parametersOf(tool)} |`,
  );
  return [
    "| Tool | Title | Returns | Parameters |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

function hintsOf(tool) {
  const { destructive, idempotent, openWorld } = tool.hints;
  return [
    destructive ? "deletes" : "does not delete",
    idempotent ? "idempotent" : "not idempotent",
    openWorld ? "uses the store" : "no store requests",
  ].join(", ");
}

function writeTableFor(tools) {
  const rows = tools.map(
    (tool) =>
      `| \`${tool.name}\` | ${tool.title} | ${summaryOf(tool)} | ${parametersOf(tool)} | ${hintsOf(tool)} |`,
  );
  return [
    "| Tool | Title | Does | Parameters | Hints |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

function render() {
  const reads = MCP_TOOLS.length;
  const writes = MCP_WRITE_TOOLS.length;
  const front = [
    "---",
    "title: MCP tool reference",
    "sidebarTitle: Tools",
    `description: "${reads} read only tools covering apps, keywords, competitors, rankings, SERPs, audits, reviews, analytics and the Action Center, plus ${writes} opt in tools that change keywords, competitors and actions."`,
    "icon: wrench",
    'keywords: ["MCP tools","list_apps","ranking_history","serp_movers","app_audit","actions_summary","track_keywords","set_action_status","read only","write tools"]',
    "mode: wide",
    "---",
    "",
    `This page is generated from the tool catalog both transports share, so it cannot drift. ${reads} tools read and nothing else: each is a \`GET\` annotated \`readOnlyHint: true\`. ${writes} more tools change things and are listed only to a token with the write scope. Almost all of them take an \`appId\`, which you get from \`list_apps\`.`,
    "",
  ];

  const changes = [
    "## Changes",
    "",
    "These tools are listed only when the connection's token has the write scope. A read only token never sees them and cannot call them. Each wraps one existing route and is annotated `readOnlyHint: false` with its own destructive, idempotent and open world hints.",
    "",
    writeTableFor(MCP_WRITE_TOOLS),
    "",
    CHANGES_NOTE,
    "",
  ];

  const groups = GROUPS.flatMap(({ title, tools, note }) => [
    `## ${title}`,
    "",
    tableFor(tools),
    "",
    note,
    "",
  ]);

  return [...front, ...groups, ...changes, TAIL].join("\n");
}

const rendered = render();
if (!CHECK) {
  await writeFile(OUTPUT, rendered, "utf8");
  console.log(`wrote ${OUTPUT} with ${MCP_TOOLS.length} tools`);
} else {
  const committed = await readFile(OUTPUT, "utf8").catch(() => "");
  if (committed === rendered) {
    console.log(`${OUTPUT} matches the tool catalog`);
  } else {
    console.error(
      `${OUTPUT} has drifted from the tool catalog, run pnpm docs:mcp-tools`,
    );
    process.exit(1);
  }
}
