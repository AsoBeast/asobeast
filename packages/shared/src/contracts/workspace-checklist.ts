import type { Store } from '../index';

export const WORKSPACE_GOALS = [
  'improve_rankings',
  'research_idea',
  'use_with_ai',
] as const;
export type WorkspaceGoal = (typeof WORKSPACE_GOALS)[number];

export const WORKSPACE_CHECKLIST_ITEMS = [
  'import_app',
  'second_market',
  'add_competitor',
  'connect_console',
  'connect_ai_client',
  'turn_on_alert',
  'reply_to_review',
  'fill_keyword_field',
] as const;
export type WorkspaceChecklistItemId =
  (typeof WORKSPACE_CHECKLIST_ITEMS)[number];

export interface WorkspaceChecklistItem {
  id: WorkspaceChecklistItemId;
  title: string;
  done: boolean;
  appId: string | null;
}

export interface WorkspaceChecklist {
  goal: WorkspaceGoal | null;
  dismissedAt: string | null;
  items: WorkspaceChecklistItem[];
  done: number;
  total: number;
}

export interface WorkspaceChecklistUpdateRequest {
  goal?: WorkspaceGoal | null;
  dismissed?: boolean;
}

export interface ChecklistAppFacts {
  id: string;
  store: Store;
  markets: number;
  competitors: number;
  keywordFields: number;
  reviewsNeedingReply: number;
}

export interface ChecklistFacts {
  apps: readonly ChecklistAppFacts[];
  consoleAvailable: boolean;
  consoleConnections: number;
  usedTokens: number;
  alertChannels: number;
  reviewsStored: boolean;
  replies: number;
}

const ITEM_TITLES: Record<WorkspaceChecklistItemId, string> = {
  import_app: 'Import an app',
  second_market: 'Track keywords in a second market',
  add_competitor: 'Add a competitor',
  connect_console: 'Connect a store console',
  connect_ai_client: 'Connect your AI client',
  turn_on_alert: 'Turn on an alert',
  reply_to_review: 'Reply to a review',
  fill_keyword_field: 'Fill your keyword field',
};

const GOAL_ORDERS: Record<WorkspaceGoal, readonly WorkspaceChecklistItemId[]> =
  {
    improve_rankings: [
      'import_app',
      'fill_keyword_field',
      'add_competitor',
      'second_market',
      'turn_on_alert',
      'connect_console',
      'reply_to_review',
      'connect_ai_client',
    ],
    research_idea: [
      'import_app',
      'add_competitor',
      'second_market',
      'fill_keyword_field',
      'connect_ai_client',
      'turn_on_alert',
      'connect_console',
      'reply_to_review',
    ],
    use_with_ai: [
      'import_app',
      'connect_ai_client',
      'turn_on_alert',
      'add_competitor',
      'second_market',
      'fill_keyword_field',
      'connect_console',
      'reply_to_review',
    ],
  };

export function orderChecklistItems(
  items: readonly WorkspaceChecklistItem[],
  goal: WorkspaceGoal | null,
): WorkspaceChecklistItem[] {
  const order: readonly WorkspaceChecklistItemId[] = goal
    ? GOAL_ORDERS[goal]
    : WORKSPACE_CHECKLIST_ITEMS;
  return [...items].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

type Satisfies = (app: ChecklistAppFacts) => boolean;

function appItem(
  id: WorkspaceChecklistItemId,
  apps: readonly ChecklistAppFacts[],
  satisfied: Satisfies,
): WorkspaceChecklistItem {
  const target = apps.find((app) => !satisfied(app)) ?? apps[0];
  return {
    id,
    title: ITEM_TITLES[id],
    done: apps.some(satisfied),
    appId: target?.id ?? null,
  };
}

function workspaceItem(
  id: WorkspaceChecklistItemId,
  count: number,
  appId: string | null = null,
): WorkspaceChecklistItem {
  return { id, title: ITEM_TITLES[id], done: count > 0, appId };
}

function applicableItems(facts: ChecklistFacts): WorkspaceChecklistItem[] {
  const { apps } = facts;
  const appStoreApps = apps.filter((app) => app.store === 'APP_STORE');
  return [
    appItem('import_app', apps, () => true),
    appItem('second_market', apps, (app) => app.markets >= 2),
    appItem('add_competitor', apps, (app) => app.competitors > 0),
    ...(facts.consoleAvailable
      ? [workspaceItem('connect_console', facts.consoleConnections)]
      : []),
    workspaceItem('connect_ai_client', facts.usedTokens),
    workspaceItem('turn_on_alert', facts.alertChannels),
    ...(facts.reviewsStored
      ? [
          workspaceItem(
            'reply_to_review',
            facts.replies,
            (apps.find((app) => app.reviewsNeedingReply > 0) ?? apps[0])?.id ??
              null,
          ),
        ]
      : []),
    ...(apps.length === 0 || appStoreApps.length > 0
      ? [
          appItem(
            'fill_keyword_field',
            appStoreApps,
            (app) => app.keywordFields > 0,
          ),
        ]
      : []),
  ];
}

export function buildChecklist(
  facts: ChecklistFacts,
  goal: WorkspaceGoal | null,
  dismissedAt: string | null,
): WorkspaceChecklist {
  const items = orderChecklistItems(applicableItems(facts), goal);
  return {
    goal,
    dismissedAt,
    items,
    done: items.filter((item) => item.done).length,
    total: items.length,
  };
}
