import { readChangeDetail } from './change-detail';

describe('readChangeDetail', () => {
  it('reads an images detail', () => {
    const detail = {
      kind: 'images',
      before: [{ position: 1, url: 'a' }],
      after: [{ position: 1, url: 'b' }],
      added: [1],
      removed: [1],
      reordered: false,
    };

    expect(readChangeDetail(detail)).toEqual(detail);
  });

  it('reads a captions detail', () => {
    const detail = { kind: 'captions', added: ['x'], removed: [] };

    expect(readChangeDetail(detail)).toEqual(detail);
  });

  it('reads an app events detail', () => {
    const detail = {
      kind: 'events',
      added: [
        {
          appEventId: 'e1',
          title: 'Spring sale',
          kind: 'APP_STORE_EVENT',
          badge: 'AVAILABLE',
          startsAt: '2026-11-20T00:00:00.000Z',
          endsAt: null,
        },
      ],
      removed: [],
    };

    expect(readChangeDetail(detail)).toEqual(detail);
  });

  it('nulls a stored event date that is not a date and keeps the row', () => {
    expect(
      readChangeDetail({
        kind: 'events',
        added: [
          {
            appEventId: 'e1',
            title: 'Spring sale',
            kind: null,
            badge: null,
            startsAt: 'soon',
            endsAt: '2026-11-27T00:00:00.000Z',
          },
        ],
        removed: [],
      }),
    ).toEqual({
      kind: 'events',
      added: [
        {
          appEventId: 'e1',
          title: 'Spring sale',
          kind: null,
          badge: null,
          startsAt: null,
          endsAt: '2026-11-27T00:00:00.000Z',
        },
      ],
      removed: [],
    });
  });

  it('reads a featuring detail', () => {
    const detail = {
      kind: 'featuring',
      added: [{ storyId: 's1', heading: null, title: 'Editors talk' }],
      removed: [{ storyId: 's2', heading: 'Featured', title: null }],
    };

    expect(readChangeDetail(detail)).toEqual(detail);
  });

  it('reads an editors choice detail', () => {
    const detail = { kind: 'editorsChoice', showsBadge: true, notes: null };

    expect(readChangeDetail(detail)).toEqual(detail);
  });

  it.each([null, undefined, 'text', 7, {}, { kind: 'unknown' }])(
    'reads %j as no detail',
    (value) => {
      expect(readChangeDetail(value)).toBeNull();
    },
  );

  it('refuses a detail whose lists are malformed', () => {
    expect(
      readChangeDetail({ kind: 'captions', added: [1], removed: [] }),
    ).toBeNull();
    expect(
      readChangeDetail({
        kind: 'events',
        added: [{ title: 'No id' }],
        removed: [],
      }),
    ).toBeNull();
    expect(
      readChangeDetail({
        kind: 'editorsChoice',
        showsBadge: 'yes',
        notes: null,
      }),
    ).toBeNull();
  });
});
