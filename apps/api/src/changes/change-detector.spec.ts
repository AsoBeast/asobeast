import { detectChanges, DiffableChangeSnapshot } from './change-detector';

function makeSnapshot(
  overrides: Partial<DiffableChangeSnapshot> = {},
): DiffableChangeSnapshot {
  return {
    title: 'My App',
    subtitle: 'A subtitle',
    summary: 'A summary',
    description: 'A description',
    version: '1.0.0',
    price: 0,
    screenshotsCount: 5,
    iconUrl: 'https://cdn/icon-1.png',
    releaseNotes: 'Initial release.',
    ...overrides,
  };
}

describe('detectChanges', () => {
  it('returns an empty array for the first snapshot (no previous)', () => {
    expect(detectChanges(null, makeSnapshot())).toEqual([]);
  });

  it('returns an empty array when nothing changed', () => {
    expect(detectChanges(makeSnapshot(), makeSnapshot())).toEqual([]);
  });

  it('stores raw values for short text fields', () => {
    const prev = makeSnapshot({ title: 'Old', subtitle: 'Old sub' });
    const next = makeSnapshot({ title: 'New Title', subtitle: 'New sub' });

    expect(detectChanges(prev, next)).toEqual([
      { field: 'title', before: 'Old', after: 'New Title' },
      { field: 'subtitle', before: 'Old sub', after: 'New sub' },
    ]);
  });

  it('stores character counts for summary and description', () => {
    const prev = makeSnapshot({ summary: 'abc', description: 'hello' });
    const next = makeSnapshot({ summary: 'abcdef', description: 'hi' });

    expect(detectChanges(prev, next)).toEqual([
      { field: 'summary', before: '3', after: '6' },
      { field: 'description', before: '5', after: '2' },
    ]);
  });

  it('stores the version as a raw string', () => {
    const prev = makeSnapshot({ version: '1.0.0' });
    const next = makeSnapshot({ version: '1.1.0' });

    expect(detectChanges(prev, next)).toEqual([
      { field: 'version', before: '1.0.0', after: '1.1.0' },
    ]);
  });

  it('stores the price as a numeric string', () => {
    const prev = makeSnapshot({ price: 0 });
    const next = makeSnapshot({ price: 4.99 });

    expect(detectChanges(prev, next)).toEqual([
      { field: 'price', before: '0', after: '4.99' },
    ]);
  });

  it('stores screenshot counts', () => {
    const prev = makeSnapshot({ screenshotsCount: 5 });
    const next = makeSnapshot({ screenshotsCount: 8 });

    expect(detectChanges(prev, next)).toEqual([
      { field: 'screenshots', before: '5', after: '8' },
    ]);
  });

  it('stores the icon urls', () => {
    const prev = makeSnapshot({ iconUrl: 'https://cdn/icon-1.png' });
    const next = makeSnapshot({ iconUrl: 'https://cdn/icon-2.png' });

    expect(detectChanges(prev, next)).toEqual([
      {
        field: 'icon',
        before: 'https://cdn/icon-1.png',
        after: 'https://cdn/icon-2.png',
      },
    ]);
  });

  it('stores whats new release notes on change', () => {
    const prev = makeSnapshot({ releaseNotes: 'Old notes' });
    const next = makeSnapshot({ releaseNotes: 'Fixed the crash on launch' });

    expect(detectChanges(prev, next)).toEqual([
      {
        field: 'whatsNew',
        before: 'Old notes',
        after: 'Fixed the crash on launch',
      },
    ]);
  });

  it('ignores unchanged release notes', () => {
    const prev = makeSnapshot({ releaseNotes: 'Same notes' });
    const next = makeSnapshot({ releaseNotes: 'Same notes' });

    expect(detectChanges(prev, next)).toEqual([]);
  });

  it('truncates long release notes to 300 chars with an ellipsis', () => {
    const long = 'x'.repeat(400);
    const prev = makeSnapshot({ releaseNotes: 'short' });
    const next = makeSnapshot({ releaseNotes: long });

    const [change] = detectChanges(prev, next);
    expect(change.field).toBe('whatsNew');
    expect(change.before).toBe('short');
    expect(change.after).toBe(`${'x'.repeat(300)}…`);
  });

  it('does not emit whats new for the first snapshot', () => {
    expect(
      detectChanges(null, makeSnapshot({ releaseNotes: 'First' })),
    ).toEqual([]);
  });

  it('represents a nullable field going from null to a value', () => {
    const prev = makeSnapshot({ subtitle: null });
    const next = makeSnapshot({ subtitle: 'Now set' });

    expect(detectChanges(prev, next)).toEqual([
      { field: 'subtitle', before: null, after: 'Now set' },
    ]);
  });
});

const keyed = (...keys: string[]) =>
  keys.map((key) => ({ key, url: `${key}/392x696bb.jpg` }));

describe('detectChanges for screenshot images', () => {
  it('reports nothing when the lists match', () => {
    const prev = makeSnapshot({
      screenshotsCount: 3,
      screenshots: keyed('a', 'b', 'c'),
    });

    expect(detectChanges(prev, { ...prev })).toEqual([]);
  });

  it('reports a replacement with an unchanged count as screenshotImages', () => {
    const prev = makeSnapshot({
      screenshotsCount: 3,
      screenshots: keyed('a', 'b', 'c'),
    });
    const next = makeSnapshot({
      screenshotsCount: 3,
      screenshots: keyed('a', 'x', 'c'),
    });

    const [change, ...rest] = detectChanges(prev, next);

    expect(rest).toEqual([]);
    expect(change).toMatchObject({
      field: 'screenshotImages',
      before: '3 screenshots',
      after: '3 screenshots, 1 replaced',
    });
    expect(change.detail).toMatchObject({
      kind: 'images',
      added: [2],
      removed: [2],
    });
  });

  it('reports a reorder as screenshotImages', () => {
    const prev = makeSnapshot({
      screenshotsCount: 2,
      screenshots: keyed('a', 'b'),
    });
    const next = makeSnapshot({
      screenshotsCount: 2,
      screenshots: keyed('b', 'a'),
    });

    expect(detectChanges(prev, next)[0]).toMatchObject({
      field: 'screenshotImages',
      after: '2 screenshots, reordered',
    });
  });

  it('keeps the numeric count event and attaches the detail when the count changes', () => {
    const prev = makeSnapshot({
      screenshotsCount: 2,
      screenshots: keyed('a', 'b'),
    });
    const next = makeSnapshot({
      screenshotsCount: 3,
      screenshots: keyed('a', 'b', 'c'),
    });

    const changes = detectChanges(prev, next);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      field: 'screenshots',
      before: '2',
      after: '3',
    });
    expect(changes[0].detail).toMatchObject({
      kind: 'images',
      added: [3],
      removed: [],
    });
  });

  it('never reports the same screenshot change twice', () => {
    const prev = makeSnapshot({
      screenshotsCount: 2,
      screenshots: keyed('a', 'b'),
    });
    const next = makeSnapshot({ screenshotsCount: 1, screenshots: keyed('a') });

    expect(
      detectChanges(prev, next).filter((change) =>
        change.field.startsWith('screenshot'),
      ),
    ).toHaveLength(1);
  });

  it('leaves the count event exactly as before when a list is unknown', () => {
    const prev = makeSnapshot({ screenshotsCount: 2 });
    const next = makeSnapshot({ screenshotsCount: 3 });

    expect(detectChanges(prev, next)).toEqual([
      { field: 'screenshots', before: '2', after: '3' },
    ]);
  });

  it('reports nothing for images when the previous snapshot has no list', () => {
    const prev = makeSnapshot({ screenshotsCount: 3 });
    const next = makeSnapshot({
      screenshotsCount: 3,
      screenshots: keyed('a', 'b', 'c'),
    });

    expect(detectChanges(prev, next)).toEqual([]);
  });
});
