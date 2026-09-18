import {
  CREATIVE_OBSERVATIONS_JSON_SCHEMA,
  CreativeInputs,
  creativeFingerprint,
  parseObservations,
  readStoredObservations,
} from './creative-observations';

describe('CREATIVE_OBSERVATIONS_JSON_SCHEMA', () => {
  const objects = (node: unknown): Array<Record<string, unknown>> => {
    if (typeof node !== 'object' || node === null) return [];
    const record = node as Record<string, unknown>;
    const children = Object.values(record).flatMap(objects);
    return record.type === 'object' ? [record, ...children] : children;
  };

  it('is strict mode ready', () => {
    expect(CREATIVE_OBSERVATIONS_JSON_SCHEMA).not.toHaveProperty('$schema');
    const nodes = objects(CREATIVE_OBSERVATIONS_JSON_SCHEMA);
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      expect(node.additionalProperties).toBe(false);
      expect([...(node.required as string[])].sort()).toEqual(
        Object.keys(node.properties as object).sort(),
      );
    }
  });
});

describe('parseObservations', () => {
  it('keeps sent positions once, normalizes languages and captions', () => {
    const parsed = parseObservations(
      {
        icon: {
          hasText: false,
          elementCount: 'one',
          contrast: 'high',
          similarCompetitorPosition: 9,
        },
        screenshots: [
          {
            position: 1,
            captionText: '  Guess any place  ',
            captionReadable: true,
            captionLanguage: 'EN',
            message: 'benefit',
          },
          {
            position: 1,
            captionText: 'duplicate',
            captionReadable: true,
            captionLanguage: 'en',
            message: 'feature',
          },
          {
            position: 7,
            captionText: 'out of range',
            captionReadable: true,
            captionLanguage: 'en',
            message: 'feature',
          },
          {
            position: 2,
            captionText: '',
            captionReadable: false,
            captionLanguage: 'english',
            message: 'ui-only',
          },
        ],
        consistentStyle: true,
      },
      { icon: true, screenshots: 6, competitorIcons: 3 },
    );

    expect(parsed.icon?.similarCompetitorPosition).toBeNull();
    expect(parsed.screenshots).toEqual([
      {
        position: 1,
        captionText: 'Guess any place',
        captionReadable: true,
        captionLanguage: 'en',
        message: 'benefit',
      },
      {
        position: 2,
        captionText: null,
        captionReadable: false,
        captionLanguage: null,
        message: 'ui-only',
      },
    ]);
  });

  it('sorts screenshots the model listed out of order', () => {
    const parsed = parseObservations(
      {
        icon: null,
        screenshots: [3, 1, 2].map((position) => ({
          position,
          captionText: `caption ${position}`,
          captionReadable: true,
          captionLanguage: 'en',
          message: 'benefit' as const,
        })),
        consistentStyle: null,
      },
      { icon: true, screenshots: 6, competitorIcons: 0 },
    );

    expect(parsed.screenshots.map((item) => item.position)).toEqual([1, 2, 3]);
  });

  it('drops what the model described but was never sent', () => {
    const parsed = parseObservations(
      {
        icon: {
          hasText: true,
          elementCount: 'one',
          contrast: 'low',
          similarCompetitorPosition: null,
        },
        screenshots: [
          {
            position: 1,
            captionText: 'Only one',
            captionReadable: true,
            captionLanguage: 'en',
            message: 'benefit',
          },
        ],
        consistentStyle: false,
      },
      { icon: false, screenshots: 1, competitorIcons: 0 },
    );

    expect(parsed.icon).toBeNull();
    expect(parsed.consistentStyle).toBeNull();
    expect(parsed.screenshots).toHaveLength(1);
  });

  it('rejects a payload that does not match, as a retryable failure', () => {
    expect(() =>
      parseObservations(
        { checks: [] },
        { icon: true, screenshots: 6, competitorIcons: 0 },
      ),
    ).toThrow(expect.objectContaining({ retryable: true }));
  });

  it('reads legacy v1 checks as no observations', () => {
    expect(readStoredObservations({ title: { verdict: 'pass' } })).toBeNull();
    expect(readStoredObservations(null)).toBeNull();
  });
});

describe('creativeFingerprint', () => {
  const inputs: CreativeInputs = {
    store: 'APP_STORE',
    country: 'us',
    title: 'Where Am I?',
    iconUrl: 'https://is1-ssl.mzstatic.com/icon.png',
    screenshotUrls: ['s1', 's2', 's3'],
    competitorIconUrls: ['c1', 'c2'],
  };

  it('ignores competitor icon order and the title', () => {
    expect(
      creativeFingerprint(
        { ...inputs, competitorIconUrls: ['c2', 'c1'], title: 'Other' },
        'gpt-4o',
      ),
    ).toBe(creativeFingerprint(inputs, 'gpt-4o'));
  });

  it.each([
    [
      'screenshot order',
      { ...inputs, screenshotUrls: ['s2', 's1', 's3'] },
      'gpt-4o',
    ],
    [
      'a new screenshot',
      { ...inputs, screenshotUrls: ['s1', 's2', 's4'] },
      'gpt-4o',
    ],
    [
      'the icon',
      { ...inputs, iconUrl: 'https://is1-ssl.mzstatic.com/icon2.png' },
      'gpt-4o',
    ],
    ['the model', inputs, 'gpt-5.6-luna'],
  ])('changes with %s', (_label, changed, model) => {
    expect(creativeFingerprint(changed, model)).not.toBe(
      creativeFingerprint(inputs, 'gpt-4o'),
    );
  });
});
