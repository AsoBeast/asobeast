import {
  PageAppEvent,
  PageFeaturedStory,
} from '../store-providers/app-store-page';
import { PageExtractFacts } from '../store-providers/page-extract-facts';
import { detectExtractChanges } from './extract-diff';

const eventOf = (
  appEventId: string,
  overrides: Partial<PageAppEvent> = {},
): PageAppEvent => ({
  appEventId,
  title: `Event ${appEventId}`,
  kind: 'APP_STORE_EVENT',
  badge: 'AVAILABLE',
  startsAt: '2026-11-20T00:00:00.000Z',
  endsAt: '2026-11-27T00:00:00.000Z',
  ...overrides,
});

const storyOf = (
  storyId: string | null,
  overrides: Partial<PageFeaturedStory> = {},
): PageFeaturedStory => ({
  storyId,
  heading: 'Featured',
  title: `Story ${storyId ?? 'untitled'}`,
  ...overrides,
});

const factsOf = (
  overrides: Partial<PageExtractFacts> = {},
): PageExtractFacts => ({
  appEvents: [],
  featuredStories: [],
  editorsChoice: null,
  ...overrides,
});

describe('detectExtractChanges', () => {
  it('records nothing when the previous extract is missing', () => {
    expect(detectExtractChanges(null, factsOf())).toEqual([]);
  });

  it('records nothing when the next extract is missing', () => {
    expect(detectExtractChanges(factsOf(), null)).toEqual([]);
  });

  it('records nothing when both extracts read the same empty shelves', () => {
    expect(detectExtractChanges(factsOf(), factsOf())).toEqual([]);
  });

  it('records an added event as a single row with the ref in the detail', () => {
    const changes = detectExtractChanges(
      factsOf(),
      factsOf({ appEvents: [eventOf('e1')] }),
    );

    expect(changes).toEqual([
      {
        field: 'inAppEvents',
        before: null,
        after: null,
        detail: {
          kind: 'events',
          added: [
            {
              appEventId: 'e1',
              title: 'Event e1',
              kind: 'APP_STORE_EVENT',
              badge: 'AVAILABLE',
              startsAt: '2026-11-20T00:00:00.000Z',
              endsAt: '2026-11-27T00:00:00.000Z',
            },
          ],
          removed: [],
        },
      },
    ]);
  });

  it('records a removed event with the ref the previous extract read', () => {
    const changes = detectExtractChanges(
      factsOf({ appEvents: [eventOf('e1', { title: 'Gone event' })] }),
      factsOf(),
    );

    expect(changes).toEqual([
      {
        field: 'inAppEvents',
        before: null,
        after: null,
        detail: {
          kind: 'events',
          added: [],
          removed: [
            expect.objectContaining({ appEventId: 'e1', title: 'Gone event' }),
          ],
        },
      },
    ]);
  });

  it('carries additions and removals of one capture on a single row', () => {
    const changes = detectExtractChanges(
      factsOf({ appEvents: [eventOf('e1'), eventOf('e2')] }),
      factsOf({ appEvents: [eventOf('e2'), eventOf('e3')] }),
    );

    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('inAppEvents');
    const detail = changes[0].detail as {
      added: unknown[];
      removed: unknown[];
    };
    expect(
      detail.added.map((ref) => (ref as { appEventId: string }).appEventId),
    ).toEqual(['e3']);
    expect(
      detail.removed.map((ref) => (ref as { appEventId: string }).appEventId),
    ).toEqual(['e1']);
  });

  it('keeps the first occurrence when one extract repeats an event id', () => {
    const changes = detectExtractChanges(
      factsOf(),
      factsOf({
        appEvents: [
          eventOf('e1'),
          eventOf('e1', { title: 'Duplicated event' }),
        ],
      }),
    );

    expect(changes).toHaveLength(1);
    const detail = changes[0].detail as {
      added: unknown[];
      removed: unknown[];
    };
    expect(
      detail.added.map((ref) => (ref as { appEventId: string }).appEventId),
    ).toEqual(['e1']);
    expect(detail.added.map((ref) => (ref as { title: string }).title)).toEqual(
      ['Event e1'],
    );
  });

  it('ignores an event whose id stayed through title and date edits', () => {
    const changes = detectExtractChanges(
      factsOf({ appEvents: [eventOf('e1')] }),
      factsOf({
        appEvents: [
          eventOf('e1', {
            title: 'Renamed event',
            kind: 'LIVE_EVENT',
            badge: 'HAPPENING',
            startsAt: '2026-12-01T00:00:00.000Z',
            endsAt: '2026-12-09T00:00:00.000Z',
          }),
        ],
      }),
    );

    expect(changes).toEqual([]);
  });

  it('records featured stories by their id and drops idless ones', () => {
    const changes = detectExtractChanges(
      factsOf({ featuredStories: [storyOf('s1'), storyOf(null)] }),
      factsOf({
        featuredStories: [
          storyOf('s1', { title: 'Edited story' }),
          storyOf('s2'),
        ],
      }),
    );

    expect(changes).toEqual([
      {
        field: 'featuring',
        before: null,
        after: null,
        detail: {
          kind: 'featuring',
          added: [{ storyId: 's2', heading: 'Featured', title: 'Story s2' }],
          removed: [],
        },
      },
    ]);
  });

  it('records a removed featured story', () => {
    const changes = detectExtractChanges(
      factsOf({ featuredStories: [storyOf('s1')] }),
      factsOf(),
    );

    expect(changes).toEqual([
      {
        field: 'featuring',
        before: null,
        after: null,
        detail: {
          kind: 'featuring',
          added: [],
          removed: [{ storyId: 's1', heading: 'Featured', title: 'Story s1' }],
        },
      },
    ]);
  });

  it('keeps the first occurrence when one extract repeats a story id', () => {
    const changes = detectExtractChanges(
      factsOf(),
      factsOf({
        featuredStories: [
          storyOf('s1'),
          storyOf('s1', { title: 'Duplicated story' }),
        ],
      }),
    );

    expect(changes).toHaveLength(1);
    const detail = changes[0].detail as {
      added: unknown[];
      removed: unknown[];
    };
    expect(
      detail.added.map((ref) => (ref as { storyId: string }).storyId),
    ).toEqual(['s1']);
    expect(detail.added.map((ref) => (ref as { title: string }).title)).toEqual(
      ['Story s1'],
    );
  });

  it('records the editors choice badge appearing with the next state', () => {
    const changes = detectExtractChanges(
      factsOf({ editorsChoice: { showsBadge: false, notes: null } }),
      factsOf({ editorsChoice: { showsBadge: true, notes: 'A favourite' } }),
    );

    expect(changes).toEqual([
      {
        field: 'editorsChoice',
        before: null,
        after: null,
        detail: {
          kind: 'editorsChoice',
          showsBadge: true,
          notes: 'A favourite',
        },
      },
    ]);
  });

  it('records the editors choice badge disappearing from a shown state', () => {
    const changes = detectExtractChanges(
      factsOf({ editorsChoice: { showsBadge: true, notes: 'A favourite' } }),
      factsOf({ editorsChoice: null }),
    );

    expect(changes).toEqual([
      {
        field: 'editorsChoice',
        before: null,
        after: null,
        detail: { kind: 'editorsChoice', showsBadge: false, notes: null },
      },
    ]);
  });

  it('records the badge appearing from a missing section', () => {
    const changes = detectExtractChanges(
      factsOf({ editorsChoice: null }),
      factsOf({ editorsChoice: { showsBadge: true, notes: null } }),
    );

    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('editorsChoice');
  });

  it('ignores a notes only editors choice change', () => {
    const changes = detectExtractChanges(
      factsOf({ editorsChoice: { showsBadge: true, notes: 'Old note' } }),
      factsOf({ editorsChoice: { showsBadge: true, notes: 'New note' } }),
    );

    expect(changes).toEqual([]);
  });

  it('ignores a badge that stayed unshown beside a notes change', () => {
    const changes = detectExtractChanges(
      factsOf({ editorsChoice: { showsBadge: false, notes: null } }),
      factsOf({ editorsChoice: { showsBadge: false, notes: 'Still hidden' } }),
    );

    expect(changes).toEqual([]);
  });

  it('records nothing when a missing section becomes an unshown badge', () => {
    const changes = detectExtractChanges(
      factsOf({ editorsChoice: null }),
      factsOf({
        editorsChoice: { showsBadge: false, notes: 'Hidden beside a note' },
      }),
    );

    expect(changes).toEqual([]);
  });

  it('records every kind of one capture in a stable order', () => {
    const changes = detectExtractChanges(
      factsOf(),
      factsOf({
        appEvents: [eventOf('e1')],
        featuredStories: [storyOf('s1')],
        editorsChoice: { showsBadge: true, notes: null },
      }),
    );

    expect(changes.map((change) => change.field)).toEqual([
      'inAppEvents',
      'featuring',
      'editorsChoice',
    ]);
  });
});
