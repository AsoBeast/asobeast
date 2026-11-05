import {
  INTEGRATIONS_PATH,
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

export interface GoalCopy {
  label: string;
  description: string;
}

const appPage =
  (segment: string) =>
  (appId: string | null): string | null =>
    appId === null ? null : `/apps/${appId}/${segment}`;

const fixed = (href: string) => (): string => href;

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
    href: appPage("keywords"),
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
    href: fixed(`${INTEGRATIONS_PATH}#api-and-mcp`),
  },
  turn_on_alert: {
    description:
      "Get an email or a webhook when something changes in your rankings, your listing or your reviews.",
    action: "Set up an alert",
    doneText: "Alerts are on",
    href: fixed("/settings#alerts"),
  },
  reply_to_review: {
    description:
      "Write a reply or let AI draft one, keep it and post it from the reviews page.",
    action: "Open reviews",
    doneText: "Reply marked",
    href: appPage("reviews?replyState=needs_reply&sort=lowest"),
  },
  fill_keyword_field: {
    description:
      "Write the private 100 character iOS keyword field and see which tracked keywords it covers.",
    action: "Open metadata",
    doneText: "Keyword field saved",
    href: appPage("metadata"),
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
