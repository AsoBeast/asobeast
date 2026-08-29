import {
  parsePublishedStatus,
  PUBLISHED_STATUS_SCHEMA_VERSION,
  PUBLISHED_SUMMARY_MAX,
} from './published-status';

function documentOf(stores: Record<string, unknown>): unknown {
  return {
    schemaVersion: PUBLISHED_STATUS_SCHEMA_VERSION,
    updatedAt: '2026-08-28T09:00:00Z',
    stores,
  };
}

describe('parsePublishedStatus', () => {
  it('reads a well formed document', () => {
    const parsed = parsePublishedStatus(
      documentOf({
        APP_STORE: { state: 'ok' },
        GOOGLE_PLAY: {
          state: 'broken',
          since: '2026-08-28T02:10:00Z',
          summary: 'Google Play changed the shape of its search response.',
        },
      }),
    );

    expect(parsed).toEqual({
      APP_STORE: { state: 'ok', since: null, summary: null },
      GOOGLE_PLAY: {
        state: 'broken',
        since: '2026-08-28T02:10:00.000Z',
        summary: 'Google Play changed the shape of its search response.',
      },
    });
  });

  it('refuses a schema version it was not written for', () => {
    expect(
      parsePublishedStatus({
        schemaVersion: PUBLISHED_STATUS_SCHEMA_VERSION + 1,
        stores: { APP_STORE: { state: 'broken' } },
      }),
    ).toBeNull();
    expect(parsePublishedStatus({ stores: {} })).toBeNull();
  });

  it('drops an unknown store rather than failing the whole document', () => {
    expect(
      parsePublishedStatus(
        documentOf({ APP_STORE: { state: 'ok' }, AMAZON: { state: 'broken' } }),
      ),
    ).toEqual({ APP_STORE: { state: 'ok', since: null, summary: null } });
  });

  it('drops a store whose state is outside the published union', () => {
    expect(
      parsePublishedStatus(
        documentOf({
          APP_STORE: { state: 'unreachable' },
          GOOGLE_PLAY: { state: 'ok' },
        }),
      ),
    ).toEqual({ GOOGLE_PLAY: { state: 'ok', since: null, summary: null } });
  });

  it('truncates an oversized summary rather than rejecting the store', () => {
    const parsed = parsePublishedStatus(
      documentOf({
        APP_STORE: { state: 'broken', summary: 'x'.repeat(400) },
      }),
    );

    expect(parsed?.APP_STORE?.summary).toHaveLength(PUBLISHED_SUMMARY_MAX);
  });

  it.each([
    ['a number', 42],
    ['an object', { text: 'nope' }],
    ['an array', ['nope']],
    ['null', null],
  ])('reads a summary that is %s as no summary at all', (_label, summary) => {
    const parsed = parsePublishedStatus(
      documentOf({ APP_STORE: { state: 'broken', summary } }),
    );

    expect(parsed?.APP_STORE?.summary).toBeNull();
  });

  it.each([
    ['not a date', 'yesterday'],
    ['a number', 1_756_000_000],
    ['absent', undefined],
    ['a date time with no offset', '2026-08-28T02:10:00'],
    ['a date with no time', '2026-08-28'],
    ['a local time with no separator', '2026-08-28 02:10:00'],
  ])('reads a since that is %s as null', (_label, since) => {
    const parsed = parsePublishedStatus(
      documentOf({ APP_STORE: { state: 'broken', since } }),
    );

    expect(parsed?.APP_STORE?.since).toBeNull();
  });

  it.each([
    ['an array', [{ state: 'broken' }]],
    ['a string', 'broken'],
    ['null', null],
    ['undefined', undefined],
    ['a number', 1],
    ['a document with no stores key', { schemaVersion: 1 }],
  ])('refuses %s', (_label, input) => {
    expect(parsePublishedStatus(input)).toBeNull();
  });

  it.each([
    ['zulu', '2026-08-28T02:10:00Z', '2026-08-28T02:10:00.000Z'],
    [
      'a positive offset',
      '2026-08-28T04:10:00+02:00',
      '2026-08-28T02:10:00.000Z',
    ],
    [
      'a negative offset',
      '2026-08-27T22:10:00-04:00',
      '2026-08-28T02:10:00.000Z',
    ],
    [
      'fractional seconds',
      '2026-08-28T02:10:00.500Z',
      '2026-08-28T02:10:00.500Z',
    ],
  ])(
    'reads a since written in %s as the same instant everywhere',
    (_label, since, expected) => {
      const parsed = parsePublishedStatus(
        documentOf({ APP_STORE: { state: 'broken', since } }),
      );

      expect(parsed?.APP_STORE?.since).toBe(expected);
    },
  );

  it('reads a document that names no store as nothing published', () => {
    expect(parsePublishedStatus(documentOf({}))).toEqual({});
  });
});
