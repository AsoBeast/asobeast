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
