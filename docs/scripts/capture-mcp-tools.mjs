import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const CATALOG = new URL(
  "../../packages/mcp-tools/dist/index.mjs",
  import.meta.url,
);

const { ACTION_TOOLS, APP_TOOLS, INSIGHT_TOOLS, KEYWORD_TOOLS, MCP_TOOLS } =
  await import(CATALOG).catch(() => {
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
    note: "Start with `list_apps`. Nothing else works without an app id.",
  },
  {
    title: "Keywords",
    tools: KEYWORD_TOOLS,
    note: "Keywords are per market, so pass `country` to scope to one storefront. `strategy` chooses the suggestion source: metadata, search, similar, developer, competitors, seasonal or reviews.\n\nEvery parameter is validated by the tool before a request leaves, against the same bounds the API enforces. A `country` is a lowercase two letter storefront code, a date is `YYYY-MM-DD`, and a `limit` or `days` window is refused rather than sent when it sits outside the range the endpoint accepts.",
  },
  {
    title: "Insights",
    tools: INSIGHT_TOOLS,
    note: "`from` and `to` are inclusive UTC date strings in `YYYY-MM-DD` form. Omit `keywordIds` on `ranking_history` to get every tracked keyword, and omit `date` on `serp_snapshot` to get the most recent one.",
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

Each tool wraps one \`GET\` on the HTTP API, so the data an agent can reach is exactly the data the endpoint returns and nothing more. Both transports read the same catalog, so the hosted endpoint and the local stdio server expose an identical surface. See [asobeast API](/api-reference/introduction).

## What is deliberately missing

There are no write tools. No tool imports, tracks, untracks, edits metadata, closes an action or queues a job.

Mutations stay backlog behind an explicit opt in. Until then an agent proposes work and you decide.
`;

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

function render() {
  const count = MCP_TOOLS.length;
  const front = [
    "---",
    "title: MCP tool reference",
    "sidebarTitle: Tools",
    `description: "${count} read only tools covering apps, keywords, rankings, SERPs, audits, reviews, analytics, the request budget and the Action Center queue."`,
    "icon: wrench",
    'keywords: ["MCP tools","list_apps","ranking_history","serp_movers","app_audit","daily_budget","read only"]',
    "mode: wide",
    "---",
    "",
    `This page is generated from the tool catalog both transports share, so it cannot drift. ${count} tools, every one of them a \`GET\` annotated \`readOnlyHint: true\`. Almost all of them take an \`appId\`, which you get from \`list_apps\`.`,
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

  return [...front, ...groups, TAIL].join("\n");
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
