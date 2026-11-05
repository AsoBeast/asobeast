import {
  INTEGRATIONS_PATH,
  WEBHOOK_EVENTS,
  type WorkspaceChecklistItemId,
  type WorkspaceGoal,
} from "@asobeast/shared";
import { STORE_CONNECTIONS_SECTION_ID } from "@/lib/store-connection-copy";

export interface ChecklistItemCopy {
  description: string;
  action: string;
  doneText: string;
  href: (appId: string | null) => string | null;
}

export interface ChecklistTip {
  label: string;
  href: (appId: string | null) => string | null;
  external?: true;
}

export interface GoalCopy {
  label: string;
  description: string;
}

const appPage =
  (segment: string) =>
  (appId: string | null): string | null =>
    appId === null ? null : `/apps/${appId}/${segment}`;

const fixed = (href: string) => (): string => href;

const KEYWORDS = appPage("keywords");
const METADATA = appPage("metadata");
const REVIEWS_NEEDING_REPLY = appPage(
  "reviews?replyState=needs_reply&sort=lowest",
);
const SETTINGS_ALERTS = "/settings#alerts";
const API_AND_MCP = `${INTEGRATIONS_PATH}#api-and-mcp`;

export const ITEM_COPY: Record<WorkspaceChecklistItemId, ChecklistItemCopy> = {
  import_app: {
    description:
      "Search the store by name or paste its URL. The listing, the keywords and the first positions arrive within minutes.",
    action: "Import an app",
    doneText: "App imported",
    href: fixed("/"),
  },
  second_market: {
    description:
      "Rankings differ by storefront. Track your keywords in another market to see where you stand there.",
    action: "Add a market",
    doneText: "Tracking in two markets",
    href: KEYWORDS,
  },
  add_competitor: {
    description:
      "See your positions next to an app you compete with, on every keyword you track.",
    action: "Add a competitor",
    doneText: "Competitor added",
    href: appPage("competitors"),
  },
  connect_console: {
    description:
      "Connect App Store Connect or the Google Play Console to see listing visits and downloads beside your rankings.",
    action: "Connect a console",
    doneText: "Console connected",
    href: fixed(`${INTEGRATIONS_PATH}#${STORE_CONNECTIONS_SECTION_ID}`),
  },
  connect_ai_client: {
    description:
      "Create a personal token and use it from Claude, Cursor or another MCP client.",
    action: "Create a token",
    doneText: "AI client connected",
    href: fixed(API_AND_MCP),
  },
  turn_on_alert: {
    description:
      "Get an email or a webhook when something changes in your rankings, your listing or your reviews.",
    action: "Set up an alert",
    doneText: "Alerts are on",
    href: fixed(SETTINGS_ALERTS),
  },
  reply_to_review: {
    description:
      "Write a reply or let AI draft one, keep it and post it from the reviews page.",
    action: "Open reviews",
    doneText: "Reply marked",
    href: REVIEWS_NEEDING_REPLY,
  },
  fill_keyword_field: {
    description:
      "Write the private 100 character iOS keyword field and see which tracked keywords it covers.",
    action: "Open metadata",
    doneText: "Keyword field saved",
    href: METADATA,
  },
};

export const GOAL_COPY: Record<WorkspaceGoal, GoalCopy> = {
  improve_rankings: {
    label: "Improve my rankings",
    description:
      "Fill the keyword field, add competitors and watch your positions move.",
  },
  research_idea: {
    label: "Research an idea",
    description:
      "Compare competitors and markets before you commit to keywords.",
  },
  use_with_ai: {
    label: "Use AsoBeast from my AI",
    description: "Connect an MCP client and let your agent read your data.",
  },
};

export const ITEM_TIPS: Record<
  WorkspaceChecklistItemId,
  readonly ChecklistTip[]
> = {
  import_app: [],
  second_market: [
    {
      label: "Search a keyword exactly by putting it in quotes",
      href: KEYWORDS,
    },
    {
      label: "Paste a comma or newline list into Add keywords",
      href: KEYWORDS,
    },
    {
      label: "See how many words each market's search reads",
      href: KEYWORDS,
    },
    {
      label:
        "Open a score to see where its popularity came from and how sure it is",
      href: KEYWORDS,
    },
  ],
  add_competitor: [
    {
      label:
        "Competitor cards show each app's rating, rating count and version",
      href: appPage("competitors"),
    },
  ],
  connect_console: [],
  connect_ai_client: [
    {
      label: "See when each token was last used and how many requests it made",
      href: fixed(API_AND_MCP),
    },
  ],
  turn_on_alert: [
    {
      label: `Choose from ${WEBHOOK_EVENTS.length} typed webhook events, rank gains included`,
      href: fixed(SETTINGS_ALERTS),
    },
    {
      label:
        "Keywords that cost requests and never rank come back as actions to retire them",
      href: appPage("actions"),
    },
  ],
  reply_to_review: [
    {
      label: "Drafts are written in the language of the review",
      href: REVIEWS_NEEDING_REPLY,
    },
  ],
  fill_keyword_field: [
    {
      label:
        "Add a localization your app ships to get more keyword field characters",
      href: METADATA,
    },
    {
      label: "Check every field against the store's limits and guidelines",
      href: METADATA,
    },
    {
      label:
        "Pick from the newest App Store localizations, including Bangla, Tamil, Telugu and Urdu",
      href: METADATA,
    },
    {
      label: "Chinese, Japanese and Thai keywords are split into words",
      href: fixed(
        "https://docs.asobeast.com/concepts/stores#how-are-auto-tracked-keywords-chosen",
      ),
      external: true,
    },
  ],
};
