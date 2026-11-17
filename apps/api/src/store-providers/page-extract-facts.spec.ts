import { pageExtractFacts } from './page-extract-facts';

describe('pageExtractFacts', () => {
  it('answers null for a raw without a page extract', () => {
    expect(pageExtractFacts(undefined)).toBeNull();
    expect(pageExtractFacts({})).toBeNull();
    expect(pageExtractFacts({ pageExtract: null })).toBeNull();
    expect(pageExtractFacts({ pageExtract: 'gone' })).toBeNull();
  });

  it('answers null for a raw that is not a record', () => {
    expect(pageExtractFacts([1, 2])).toBeNull();
    expect(pageExtractFacts('raw')).toBeNull();
  });

  it('narrows the events of a readable extract', () => {
    const facts = pageExtractFacts({
      pageExtract: {
        appEvents: [
          {
            appEventId: 'e1',
            title: 'Spring sale',
            kind: 'APP_STORE_EVENT',
            badge: 'AVAILABLE',
            startsAt: '2026-11-20T00:00:00.000Z',
            endsAt: '2026-11-27T00:00:00.000Z',
          },
          { appEventId: 'e2' },
          { appEventId: '', title: 'Nameless' },
          'not-a-record',
        ],
        featuredStories: [],
        editorsChoice: null,
      },
    });

    expect(facts).toEqual({
      appEvents: [
        {
          appEventId: 'e1',
          title: 'Spring sale',
          kind: 'APP_STORE_EVENT',
          badge: 'AVAILABLE',
          startsAt: '2026-11-20T00:00:00.000Z',
          endsAt: '2026-11-27T00:00:00.000Z',
        },
        {
          appEventId: 'e2',
          title: null,
          kind: null,
          badge: null,
          startsAt: null,
          endsAt: null,
        },
      ],
      featuredStories: [],
      editorsChoice: null,
    });
  });

  it('drops a stored event date that is not a date', () => {
    const facts = pageExtractFacts({
      pageExtract: {
        appEvents: [
          {
            appEventId: 'e1',
            title: 'Spring sale',
            kind: null,
            badge: null,
            startsAt: 'mid November',
            endsAt: '2026-11-27T00:00:00.000Z',
          },
        ],
        featuredStories: [],
        editorsChoice: null,
      },
    });

    expect(facts?.appEvents).toEqual([
      {
        appEventId: 'e1',
        title: 'Spring sale',
        kind: null,
        badge: null,
        startsAt: null,
        endsAt: '2026-11-27T00:00:00.000Z',
      },
    ]);
  });

  it('narrows the featured stories keeping the idless ones', () => {
    const facts = pageExtractFacts({
      pageExtract: {
        appEvents: [],
        featuredStories: [
          { storyId: 's1', heading: 'Featured', title: 'Editors talk' },
          { heading: 'Only a heading' },
          { storyId: 7 },
        ],
        editorsChoice: null,
      },
    });

    expect(facts?.featuredStories).toEqual([
      { storyId: 's1', heading: 'Featured', title: 'Editors talk' },
      { storyId: null, heading: 'Only a heading', title: null },
    ]);
  });

  it('narrows the editors choice and its notes', () => {
    const shown = pageExtractFacts({
      pageExtract: {
        appEvents: [],
        featuredStories: [],
        editorsChoice: { showsBadge: true, notes: 'A favourite' },
      },
    });
    expect(shown?.editorsChoice).toEqual({
      showsBadge: true,
      notes: 'A favourite',
    });

    const unshown = pageExtractFacts({
      pageExtract: {
        appEvents: [],
        featuredStories: [],
        editorsChoice: { showsBadge: 'yes', notes: 3 },
      },
    });
    expect(unshown?.editorsChoice).toEqual({ showsBadge: false, notes: null });

    const absent = pageExtractFacts({
      pageExtract: {
        appEvents: [],
        featuredStories: [],
        editorsChoice: null,
      },
    });
    expect(absent?.editorsChoice).toBeNull();
  });
});
