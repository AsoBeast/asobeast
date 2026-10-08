import {
  diffSnapshots,
  DiffableSnapshot,
  withRecordedChanges,
} from './snapshot-diff';

function makeSnapshot(
  overrides: Partial<DiffableSnapshot> = {},
): DiffableSnapshot {
  return {
    title: 'My App',
    subtitle: 'A subtitle',
    summary: 'A summary',
    description: 'A description',
    ratingAvg: 4.5,
    ratingCount: 1000,
    installs: null,
    version: '1.0.0',
    ...overrides,
  };
}

describe('diffSnapshots', () => {
  it('returns an empty array for the first snapshot (no previous)', () => {
    expect(diffSnapshots(null, makeSnapshot())).toEqual([]);
  });

  it('returns an empty array when nothing changed', () => {
    const prev = makeSnapshot();
    const next = makeSnapshot();
    expect(diffSnapshots(prev, next)).toEqual([]);
  });

  it('reports a changed title as old/new lengths, not full text', () => {
    const prev = makeSnapshot({ title: 'Old' });
    const next = makeSnapshot({ title: 'Brand New Title' });

    expect(diffSnapshots(prev, next)).toEqual([
      { field: 'title', before: 3, after: 15 },
    ]);
  });

  it('reports value fields with their actual before/after values', () => {
    const prev = makeSnapshot({
      ratingAvg: 4.5,
      ratingCount: 1000,
      version: '1.0.0',
    });
    const next = makeSnapshot({
      ratingAvg: 4.7,
      ratingCount: 1200,
      version: '1.1.0',
    });

    expect(diffSnapshots(prev, next)).toEqual([
      { field: 'ratingAvg', before: 4.5, after: 4.7 },
      { field: 'ratingCount', before: 1000, after: 1200 },
      { field: 'version', before: '1.0.0', after: '1.1.0' },
    ]);
  });

  it('converts installs from bigint to number', () => {
    const prev = makeSnapshot({ installs: 1000n });
    const next = makeSnapshot({ installs: 5000n });

    expect(diffSnapshots(prev, next)).toEqual([
      { field: 'installs', before: 1000, after: 5000 },
    ]);
  });

  it('represents a nullable text going from null to a value as lengths', () => {
    const prev = makeSnapshot({ subtitle: null });
    const next = makeSnapshot({ subtitle: 'Now set' });

    expect(diffSnapshots(prev, next)).toEqual([
      { field: 'subtitle', before: null, after: 7 },
    ]);
  });
});

describe('withRecordedChanges', () => {
  const titleDiff = { field: 'title', before: 3, after: 15 };

  it('returns the diff unchanged when nothing was recorded', () => {
    expect(withRecordedChanges([titleDiff], [])).toEqual([titleDiff]);
  });

  it('appends a recorded screenshot change without its detail', () => {
    expect(
      withRecordedChanges(
        [],
        [
          {
            field: 'screenshotImages',
            before: '8 screenshots',
            after: '8 screenshots, reordered',
            detail: {
              kind: 'images',
              before: [],
              after: [],
              added: [],
              removed: [],
              reordered: true,
            },
          },
        ],
      ),
    ).toEqual([
      {
        field: 'screenshotImages',
        before: '8 screenshots',
        after: '8 screenshots, reordered',
      },
    ]);
  });

  it('appends recorded price, icon and whats new changes in recorded order', () => {
    expect(
      withRecordedChanges(
        [],
        [
          { field: 'price', before: '0', after: '2.99' },
          {
            field: 'icon',
            before: 'https://example.com/a.png',
            after: 'https://example.com/b.png',
          },
          { field: 'whatsNew', before: 'Bug fixes', after: 'New maps' },
        ],
      ).map((change) => change.field),
    ).toEqual(['price', 'icon', 'whatsNew']);
  });

  it('keeps the diff entry for a field both report and never reports it twice', () => {
    const diff = [
      titleDiff,
      { field: 'summary', before: 10, after: 12 },
      { field: 'version', before: '1.0.0', after: '1.1.0' },
    ];

    expect(
      withRecordedChanges(diff, [
        { field: 'title', before: 'Old', after: 'Brand New Title' },
        { field: 'summary', before: '10', after: '12' },
        { field: 'version', before: '1.0.0', after: '1.1.0' },
      ]),
    ).toEqual(diff);
  });
});
