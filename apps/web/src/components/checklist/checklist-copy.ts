import {
  INTEGRATIONS_PATH,
  WEBHOOK_EVENTS,
  type WorkspaceChecklistItemId,
  type WorkspaceGoal,
} from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";
import { STORE_CONNECTIONS_SECTION_ID } from "@/lib/store-connection-copy";

export interface ChecklistItemCopy {
  catalogKey: string;
  titleKey: string;
  descriptionKey: string;
  actionKey: string;
  doneTextKey: string;
  href: (appId: string | null) => string | null;
}

export interface ChecklistTip {
  labelKey: string;
  values?: Record<string, string | number>;
  href: (appId: string | null) => string | null;
  external?: true;
}

export interface GoalCopy {
  catalogKey: string;
  labelKey: string;
  descriptionKey: string;
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

const item = (
  catalogKey: string,
  href: (appId: string | null) => string | null,
): ChecklistItemCopy => ({
  catalogKey,
  titleKey: `checklist.items.${catalogKey}.title`,
  descriptionKey: `checklist.items.${catalogKey}.description`,
  actionKey: `checklist.items.${catalogKey}.action`,
  doneTextKey: `checklist.items.${catalogKey}.doneText`,
  href,
});

export const ITEM_COPY: Record<WorkspaceChecklistItemId, ChecklistItemCopy> = {
  import_app: item("importApp", fixed("/")),
  second_market: item("secondMarket", KEYWORDS),
  add_competitor: item("addCompetitor", appPage("competitors")),
  connect_console: item(
    "connectConsole",
    fixed(`${INTEGRATIONS_PATH}#${STORE_CONNECTIONS_SECTION_ID}`),
  ),
  connect_ai_client: item("connectAiClient", fixed(API_AND_MCP)),
  turn_on_alert: item("turnOnAlert", fixed(SETTINGS_ALERTS)),
  reply_to_review: item("replyToReview", REVIEWS_NEEDING_REPLY),
  fill_keyword_field: item("fillKeywordField", METADATA),
};

export function checklistItemCopy(
  id: WorkspaceChecklistItemId,
  translator: MessageTranslator,
) {
  const copy = ITEM_COPY[id];
  return {
    title: translator(copy.titleKey),
    description: translator(copy.descriptionKey),
    action: translator(copy.actionKey),
    doneText: translator(copy.doneTextKey),
    href: copy.href,
  };
}

export const GOAL_COPY: Record<WorkspaceGoal, GoalCopy> = {
  improve_rankings: {
    catalogKey: "improveRankings",
    labelKey: "checklist.goals.improveRankings.label",
    descriptionKey: "checklist.goals.improveRankings.description",
  },
  research_idea: {
    catalogKey: "researchIdea",
    labelKey: "checklist.goals.researchIdea.label",
    descriptionKey: "checklist.goals.researchIdea.description",
  },
  use_with_ai: {
    catalogKey: "useWithAi",
    labelKey: "checklist.goals.useWithAi.label",
    descriptionKey: "checklist.goals.useWithAi.description",
  },
};

export function checklistGoalCopy(
  goal: WorkspaceGoal,
  translator: MessageTranslator,
) {
  const copy = GOAL_COPY[goal];
  return {
    label: translator(copy.labelKey),
    description: translator(copy.descriptionKey),
  };
}

export const ITEM_TIPS: Record<
  WorkspaceChecklistItemId,
  readonly ChecklistTip[]
> = {
  import_app: [],
  second_market: [
    {
      labelKey: "checklist.tips.secondMarket.quotes",
      href: KEYWORDS,
    },
    {
      labelKey: "checklist.tips.secondMarket.pasteList",
      href: KEYWORDS,
    },
    {
      labelKey: "checklist.tips.secondMarket.searchWords",
      href: KEYWORDS,
    },
    {
      labelKey: "checklist.tips.secondMarket.score",
      href: KEYWORDS,
    },
  ],
  add_competitor: [
    {
      labelKey: "checklist.tips.addCompetitor.rating",
      href: appPage("competitors"),
    },
  ],
  connect_console: [],
  connect_ai_client: [
    {
      labelKey: "checklist.tips.connectAiClient.usage",
      href: fixed(API_AND_MCP),
    },
  ],
  turn_on_alert: [
    {
      labelKey: "checklist.tips.turnOnAlert.events",
      values: { count: WEBHOOK_EVENTS.length },
      href: fixed(SETTINGS_ALERTS),
    },
    {
      labelKey: "checklist.tips.turnOnAlert.retire",
      href: appPage("actions"),
    },
  ],
  reply_to_review: [
    {
      labelKey: "checklist.tips.replyToReview.language",
      href: REVIEWS_NEEDING_REPLY,
    },
  ],
  fill_keyword_field: [
    {
      labelKey: "checklist.tips.fillKeywordField.localization",
      href: METADATA,
    },
    {
      labelKey: "checklist.tips.fillKeywordField.limits",
      href: METADATA,
    },
    {
      labelKey: "checklist.tips.fillKeywordField.newest",
      href: METADATA,
    },
    {
      labelKey: "checklist.tips.fillKeywordField.words",
      href: fixed(
        "https://docs.asobeast.com/concepts/stores#how-are-auto-tracked-keywords-chosen",
      ),
      external: true,
    },
  ],
};

export function checklistTips(
  id: WorkspaceChecklistItemId,
  translator: MessageTranslator,
) {
  return ITEM_TIPS[id].map((tip) => ({
    label: translator(tip.labelKey, tip.values),
    href: tip.href,
    external: tip.external,
  }));
}
