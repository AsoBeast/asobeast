import type { ActionActivity, ActionItem } from "@asobeast/shared";
import { ACTION_ACTIVITY } from "./action-details.mts";
import { ACTIONS } from "./fixtures.mts";

export const CROWDED_COOKIE = "e2e_actions_crowded";

export const RTL_KEYWORD = "مؤقت التركيز";

const CROWDED_APPS = [
  ["app-1", "Focus Timer", "us"],
  ["app-gp", "Tomato Clock", "de"],
  ["app-2", "Habit Tracker", "us"],
  ["app-crowd-4", "Calm Notes", "fr"],
  ["app-crowd-5", "Zen Timer", "jp"],
  ["app-crowd-6", "Study Buddy", "br"],
  ["app-crowd-7", "Deep Work Log", "sa"],
] as const;

const template = ACTIONS.find((action) => action.id === "act-prune")!;

export const CROWDED_ACTIONS: ActionItem[] = CROWDED_APPS.map(
  ([appId, appName, country], index) => ({
    ...structuredClone(template),
    id: `act-crowd-${index + 1}`,
    impact: template.impact - index,
    scope: {
      ...template.scope,
      appId,
      appName,
      country,
      keywordText: index === 0 ? RTL_KEYWORD : `phrase ${index + 1}`,
    },
  }),
);

const ACTIVE_DAYS = 2;

export const SPARSE_ACTION_ACTIVITY: ActionActivity = {
  ...ACTION_ACTIVITY,
  days: ACTION_ACTIVITY.days.map((day, index, days) => ({
    date: day.date,
    opened: index >= days.length - ACTIVE_DAYS ? 1 : 0,
    reopened: 0,
    done: 0,
    dismissed: 0,
    resolved: 0,
    verified: 0,
  })),
  totals: {
    opened: ACTIVE_DAYS,
    reopened: 0,
    done: 0,
    dismissed: 0,
    resolved: 0,
    verified: 0,
  },
};
