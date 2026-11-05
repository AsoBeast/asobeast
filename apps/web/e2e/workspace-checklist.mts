import type { BrowserContext } from "@playwright/test";
import {
  buildChecklist,
  type ChecklistAppFacts,
  type ChecklistFacts,
  type WorkspaceChecklist,
  type WorkspaceGoal,
} from "@asobeast/shared";

export const CHECKLIST_COOKIE = "e2e_checklist";
export const CHECKLIST_FAIL_COOKIE = "e2e_checklist_fail";
export const CHECKLIST_READ_FAIL_COOKIE = "e2e_checklist_read_fail";

export const CHECKLIST_SCENARIOS = [
  "fresh",
  "partial",
  "complete",
  "play-only",
  "no-console",
  "no-reviews",
  "collecting",
] as const;
export type ChecklistScenario = (typeof CHECKLIST_SCENARIOS)[number];

export interface ChecklistPreferences {
  goal: WorkspaceGoal | null;
  dismissedAt: string | null;
}

const FOCUS_TIMER: ChecklistAppFacts = {
  id: "app-1",
  store: "APP_STORE",
  markets: 1,
  competitors: 1,
  keywordFields: 0,
  reviewsNeedingReply: 1,
};

const PARTIAL: ChecklistFacts = {
  apps: [FOCUS_TIMER],
  consoleAvailable: true,
  consoleConnections: 0,
  usedTokens: 0,
  alertChannels: 0,
  reviewsStored: true,
  replies: 0,
};

const FACTS: Record<ChecklistScenario, ChecklistFacts> = {
  fresh: { ...PARTIAL, apps: [], reviewsStored: false },
  partial: PARTIAL,
  complete: {
    apps: [{ ...FOCUS_TIMER, markets: 2, keywordFields: 1 }],
    consoleAvailable: true,
    consoleConnections: 1,
    usedTokens: 1,
    alertChannels: 1,
    reviewsStored: true,
    replies: 1,
  },
  "play-only": {
    ...PARTIAL,
    apps: [{ ...FOCUS_TIMER, id: "app-gp", store: "GOOGLE_PLAY" }],
  },
  "no-console": { ...PARTIAL, consoleAvailable: false },
  "no-reviews": { ...PARTIAL, reviewsStored: false },
  collecting: { ...PARTIAL, apps: [{ ...FOCUS_TIMER, id: "app-new" }] },
};

export const VISIBLE: ChecklistPreferences = { goal: null, dismissedAt: null };

export const HIDDEN_BY_DEFAULT: ChecklistPreferences = {
  goal: null,
  dismissedAt: "2026-11-01T00:00:00.000Z",
};

export function isChecklistScenario(
  value: string | undefined,
): value is ChecklistScenario {
  return CHECKLIST_SCENARIOS.some((scenario) => scenario === value);
}

export function checklistOf(
  scenario: ChecklistScenario,
  preferences: ChecklistPreferences,
): WorkspaceChecklist {
  return buildChecklist(
    FACTS[scenario],
    preferences.goal,
    preferences.dismissedAt,
  );
}

export async function seedChecklist(
  context: BrowserContext,
  scenario: ChecklistScenario,
): Promise<void> {
  await context.addCookies([
    { name: CHECKLIST_COOKIE, value: scenario, domain: "localhost", path: "/" },
  ]);
}
