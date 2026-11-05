import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  buildChecklist,
  orderChecklistItems,
  WORKSPACE_CHECKLIST_ITEMS,
  WORKSPACE_GOALS,
  type ChecklistAppFacts,
  type ChecklistFacts,
  type WorkspaceChecklist,
  type WorkspaceChecklistItem,
  type WorkspaceChecklistItemId,
  type WorkspaceChecklistUpdateRequest,
  type WorkspaceGoal,
} from '../index';

const facts = (overrides: Partial<ChecklistFacts> = {}): ChecklistFacts => ({
  apps: [],
  consoleAvailable: true,
  consoleConnections: 0,
  usedTokens: 0,
  alertChannels: 0,
  reviewsStored: false,
  replies: 0,
  ...overrides,
});

const app = (
  id: string,
  overrides: Partial<ChecklistAppFacts> = {},
): ChecklistAppFacts => ({
  id,
  store: 'APP_STORE',
  markets: 1,
  competitors: 0,
  keywordFields: 0,
  reviewsNeedingReply: 0,
  ...overrides,
});

const itemOf = (
  checklist: WorkspaceChecklist,
  id: WorkspaceChecklistItemId,
): WorkspaceChecklistItem | undefined =>
  checklist.items.find((item) => item.id === id);

const ids = (items: readonly WorkspaceChecklistItem[]) =>
  items.map((item) => item.id);

const everyItem: WorkspaceChecklistItem[] = WORKSPACE_CHECKLIST_ITEMS.map(
  (id) => ({ id, title: id, done: false, appId: null }),
);

const goals: (WorkspaceGoal | null)[] = [...WORKSPACE_GOALS, null];

describe('the workspace checklist vocabulary', () => {
  it('names three goals', () => {
    expect(WORKSPACE_GOALS).toEqual([
      'improve_rankings',
      'research_idea',
      'use_with_ai',
    ]);
  });

  it('lists the eight items in the default order', () => {
    expect(WORKSPACE_CHECKLIST_ITEMS).toEqual([
      'import_app',
      'second_market',
      'add_competitor',
      'connect_console',
      'connect_ai_client',
      'turn_on_alert',
      'reply_to_review',
      'fill_keyword_field',
    ]);
  });
});

describe('orderChecklistItems', () => {
  it.each(goals)('orders every item for %s', (goal) => {
    expect(ids(orderChecklistItems(everyItem, goal)).sort()).toEqual(
      [...WORKSPACE_CHECKLIST_ITEMS].sort(),
    );
  });

  it.each([
    [
      'improve_rankings',
      ['import_app', 'fill_keyword_field', 'add_competitor'],
    ],
    ['research_idea', ['import_app', 'add_competitor', 'second_market']],
    ['use_with_ai', ['import_app', 'connect_ai_client', 'turn_on_alert']],
  ] as const)('starts %s with the steps that matter for it', (goal, first) => {
    expect(ids(orderChecklistItems(everyItem, goal)).slice(0, 3)).toEqual(
      first,
    );
  });

  it('keeps the default order without a goal', () => {
    expect(ids(orderChecklistItems(everyItem, null))).toEqual(
      WORKSPACE_CHECKLIST_ITEMS,
    );
  });

  it('leaves its input untouched', () => {
    const before = ids(everyItem);
    orderChecklistItems(everyItem, 'use_with_ai');
    expect(ids(everyItem)).toEqual(before);
  });

  it('keeps a partial list in relative order', () => {
    const partial = everyItem.filter(
      (item) => item.id !== 'fill_keyword_field',
    );
    expect(ids(orderChecklistItems(partial, 'improve_rankings'))).toEqual([
      'import_app',
      'add_competitor',
      'second_market',
      'turn_on_alert',
      'connect_console',
      'reply_to_review',
      'connect_ai_client',
    ]);
  });
});

describe('buildChecklist', () => {
  it('answers seven open items for an empty workspace', () => {
    const checklist = buildChecklist(facts(), null, null);
    expect(checklist.done).toBe(0);
    expect(checklist.total).toBe(7);
    expect(ids(checklist.items)).toEqual([
      'import_app',
      'second_market',
      'add_competitor',
      'connect_console',
      'connect_ai_client',
      'turn_on_alert',
      'fill_keyword_field',
    ]);
    expect(checklist.items.every((item) => item.appId === null)).toBe(true);
    expect(checklist.items[0]).toEqual({
      id: 'import_app',
      title: 'Import an app',
      done: false,
      appId: null,
    });
  });

  it('targets the only app for every app bound item', () => {
    const checklist = buildChecklist(facts({ apps: [app('a')] }), null, null);
    expect(itemOf(checklist, 'import_app')).toMatchObject({
      done: true,
      appId: 'a',
    });
    for (const id of [
      'second_market',
      'add_competitor',
      'fill_keyword_field',
    ] as const) {
      expect(itemOf(checklist, id)).toMatchObject({ done: false, appId: 'a' });
    }
    for (const id of [
      'turn_on_alert',
      'connect_console',
      'connect_ai_client',
    ] as const) {
      expect(itemOf(checklist, id)).toMatchObject({ done: false, appId: null });
    }
    expect(checklist.done).toBe(1);
  });

  it.each([
    ['add_competitor', { competitors: 1 }],
    ['second_market', { markets: 2 }],
    ['fill_keyword_field', { keywordFields: 1 }],
  ] as const)(
    'targets the oldest app that lacks %s',
    (id, satisfied: Partial<ChecklistAppFacts>) => {
      const some = buildChecklist(
        facts({ apps: [app('a', satisfied), app('b'), app('c')] }),
        null,
        null,
      );
      expect(itemOf(some, id)).toMatchObject({ done: true, appId: 'b' });

      const all = buildChecklist(
        facts({
          apps: [app('a', satisfied), app('b', satisfied), app('c', satisfied)],
        }),
        null,
        null,
      );
      expect(itemOf(all, id)).toMatchObject({ done: true, appId: 'a' });
    },
  );

  it('leaves the keyword field out of a Google Play workspace', () => {
    const playOnly = buildChecklist(
      facts({ apps: [app('p', { store: 'GOOGLE_PLAY' })] }),
      null,
      null,
    );
    expect(itemOf(playOnly, 'fill_keyword_field')).toBeUndefined();
    expect(playOnly.total).toBe(6);

    const mixed = buildChecklist(
      facts({ apps: [app('p', { store: 'GOOGLE_PLAY' }), app('i')] }),
      null,
      null,
    );
    expect(itemOf(mixed, 'fill_keyword_field')).toMatchObject({
      done: false,
      appId: 'i',
    });
  });

  it('counts only an App Store keyword field', () => {
    const checklist = buildChecklist(
      facts({
        apps: [app('p', { store: 'GOOGLE_PLAY', keywordFields: 1 }), app('i')],
      }),
      null,
      null,
    );
    expect(itemOf(checklist, 'fill_keyword_field')).toMatchObject({
      done: false,
      appId: 'i',
    });
  });

  it('asks for a console only when the instance can hold a key', () => {
    expect(
      itemOf(
        buildChecklist(facts({ consoleAvailable: false }), null, null),
        'connect_console',
      ),
    ).toBeUndefined();
    expect(
      itemOf(
        buildChecklist(facts({ consoleConnections: 1 }), null, null),
        'connect_console',
      ),
    ).toMatchObject({ done: true, appId: null });
  });

  it('asks for a reply once a review is stored', () => {
    const apps = [app('a'), app('b')];
    expect(
      itemOf(buildChecklist(facts({ apps }), null, null), 'reply_to_review'),
    ).toBeUndefined();
    expect(
      itemOf(
        buildChecklist(facts({ apps, reviewsStored: true }), null, null),
        'reply_to_review',
      ),
    ).toMatchObject({ done: false, appId: 'a' });
    expect(
      itemOf(
        buildChecklist(
          facts({ apps, reviewsStored: true, replies: 1 }),
          null,
          null,
        ),
        'reply_to_review',
      ),
    ).toMatchObject({ done: true });
  });

  it('points the reply at the oldest app with a review that needs one', () => {
    const checklist = buildChecklist(
      facts({
        apps: [
          app('a'),
          app('b', { reviewsNeedingReply: 1 }),
          app('c', { reviewsNeedingReply: 1 }),
        ],
        reviewsStored: true,
      }),
      null,
      null,
    );
    expect(itemOf(checklist, 'reply_to_review')).toMatchObject({
      done: false,
      appId: 'b',
    });
  });

  it('marks the workspace items from their counts', () => {
    const checklist = buildChecklist(
      facts({ usedTokens: 1, alertChannels: 2 }),
      null,
      null,
    );
    expect(itemOf(checklist, 'connect_ai_client')?.done).toBe(true);
    expect(itemOf(checklist, 'turn_on_alert')?.done).toBe(true);
    expect(checklist.done).toBe(2);
  });

  it('counts eight of eight when everything is satisfied', () => {
    const checklist = buildChecklist(
      facts({
        apps: [app('a', { markets: 2, competitors: 1, keywordFields: 1 })],
        consoleConnections: 1,
        usedTokens: 1,
        alertChannels: 1,
        reviewsStored: true,
        replies: 1,
      }),
      null,
      null,
    );
    expect(checklist.done).toBe(8);
    expect(checklist.total).toBe(8);
  });

  it('counts done among the items it lists', () => {
    const checklist = buildChecklist(
      facts({ consoleAvailable: false, consoleConnections: 1 }),
      null,
      null,
    );
    expect(checklist.done).toBe(0);
    expect(checklist.total).toBe(6);
  });

  it('passes the goal and the dismissal through', () => {
    const chosen = buildChecklist(
      facts(),
      'research_idea',
      '2026-11-03T10:00:00.000Z',
    );
    expect(chosen.goal).toBe('research_idea');
    expect(chosen.dismissedAt).toBe('2026-11-03T10:00:00.000Z');
    expect(ids(chosen.items).slice(0, 2)).toEqual([
      'import_app',
      'add_competitor',
    ]);

    const none = buildChecklist(facts(), null, null);
    expect(none.goal).toBeNull();
    expect(none.dismissedAt).toBeNull();
  });

  it('types its answer with the shared vocabulary', () => {
    expectTypeOf<WorkspaceChecklistUpdateRequest>().toEqualTypeOf<{
      goal?: WorkspaceGoal | null;
      dismissed?: boolean;
    }>();
    expectTypeOf<
      WorkspaceChecklist['items'][number]['id']
    >().toEqualTypeOf<WorkspaceChecklistItemId>();
  });
});
