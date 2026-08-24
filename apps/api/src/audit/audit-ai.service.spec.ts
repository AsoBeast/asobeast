import { BadGatewayException, ConflictException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { AiClient } from '../ai/openai.client';
import {
  AiAuditInput,
  AuditAiService,
  buildAuditContent,
  SUBJECTIVE_CHECK_IDS,
  validateAuditChecks,
} from './audit-ai.service';

const fullChecks = (
  overrides: Record<string, { score: number | null; detail: string }> = {},
) => ({
  checks: SUBJECTIVE_CHECK_IDS.map((id) => ({
    id,
    score: overrides[id]?.score ?? null,
    detail: overrides[id]?.detail ?? 'Not assessed.',
  })),
});

const baseInput = (overrides: Partial<AiAuditInput> = {}): AiAuditInput => ({
  store: Store.APP_STORE,
  country: 'us',
  title: 'Habit Tracker',
  subtitle: 'Daily Streaks',
  summary: null,
  description: 'Build better habits every day.',
  genreName: 'Productivity',
  languages: ['EN'],
  releaseNotes: 'Bug fixes.',
  hasVideo: null,
  ratingAvg: 4.5,
  ratingCount: 100,
  iconUrl: null,
  screenshotUrls: [],
  ...overrides,
});

describe('validateAuditChecks', () => {
  it('keeps known ids, clamps scores, dedupes and defaults blank detail', () => {
    const out = validateAuditChecks({
      checks: [
        { id: 'icon-simple', score: -3, detail: '  Clean.  ' },
        { id: 'icon-simple', score: 9, detail: 'duplicate ignored' },
        { id: 'screenshots-consistent', score: 12, detail: 'Great.' },
        { id: 'not-a-real-check', score: 5, detail: 'dropped' },
        { id: 'icon-no-text', score: 4.6, detail: '' },
        'garbage',
      ],
    });
    expect(out).toEqual({
      'icon-simple': { score: 0, detail: 'Clean.' },
      'screenshots-consistent': { score: 10, detail: 'Great.' },
      'icon-no-text': { score: 5, detail: 'No rationale provided.' },
    });
  });

  it('tolerates non-object input without throwing', () => {
    expect(validateAuditChecks(null)).toEqual({});
    expect(validateAuditChecks({ checks: 'nope' })).toEqual({});
    expect(validateAuditChecks(42)).toEqual({});
  });

  it('keeps an explicit null score and nulls out an unparseable score', () => {
    const out = validateAuditChecks({
      checks: [
        { id: 'icon-simple', score: null, detail: 'No icon evidence.' },
        { id: 'ratings-responses', score: 'high', detail: 'Cannot tell.' },
      ],
    });
    expect(out['icon-simple']).toEqual({
      score: null,
      detail: 'No icon evidence.',
    });
    expect(out['ratings-responses'].score).toBeNull();
  });
});

describe('buildAuditContent', () => {
  it('emits a text block then the icon and up to six screenshots', () => {
    const parts = buildAuditContent(
      baseInput({
        iconUrl: 'https://cdn/icon.png',
        screenshotUrls: Array.from(
          { length: 8 },
          (_, i) => `https://cdn/s${i}`,
        ),
      }),
    );
    expect(parts[0].type).toBe('text');
    const images = parts.filter((part) => part.type === 'image');
    expect(images).toHaveLength(7);
    expect(images[0]).toEqual({ type: 'image', url: 'https://cdn/icon.png' });
  });

  it('omits image parts when no creative is available', () => {
    const parts = buildAuditContent(baseInput());
    expect(parts.every((part) => part.type === 'text')).toBe(true);
  });
});

describe('AuditAiService', () => {
  it('rejects when no client is configured', async () => {
    const service = new AuditAiService(null);
    expect(service.configured).toBe(false);
    await expect(service.generate(baseInput())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('sends the creative and returns every factor, keeping nulls', async () => {
    const structured = jest.fn().mockResolvedValue(
      fullChecks({
        'icon-simple': { score: 9, detail: 'Clean.' },
        'screenshots-consistent': { score: 12, detail: 'Cohesive.' },
      }),
    );
    const client: AiClient = { model: 'gpt-4o', structured };
    const service = new AuditAiService(client);

    const result = await service.generate(
      baseInput({
        iconUrl: 'https://cdn/icon.png',
        screenshotUrls: ['https://cdn/s0', 'https://cdn/s1'],
      }),
    );

    expect(service.configured).toBe(true);
    expect(service.model).toBe('gpt-4o');
    expect(result['icon-simple']).toEqual({ score: 9, detail: 'Clean.' });
    expect(result['screenshots-consistent'].score).toBe(10);
    expect(Object.keys(result)).toHaveLength(SUBJECTIVE_CHECK_IDS.length);
    expect(result['icon-no-text'].score).toBeNull();
    const calls = structured.mock.calls as Array<
      [{ content: Array<{ type: string; url?: string }> }]
    >;
    const imageUrls = calls[0][0].content
      .filter((part) => part.type === 'image')
      .map((part) => part.url);
    expect(imageUrls).toEqual([
      'https://cdn/icon.png',
      'https://cdn/s0',
      'https://cdn/s1',
    ]);
  });

  it('fails when the response is missing factors', async () => {
    const structured = jest.fn().mockResolvedValue({
      checks: [{ id: 'icon-simple', score: 8, detail: 'Clean.' }],
    });
    const service = new AuditAiService({ model: 'gpt-4o', structured });
    await expect(
      service.generate(baseInput({ iconUrl: 'https://cdn/icon.png' })),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('fails when a complete response scores nothing for an app with creative', async () => {
    const structured = jest.fn().mockResolvedValue(fullChecks());
    const service = new AuditAiService({ model: 'gpt-4o', structured });
    await expect(
      service.generate(baseInput({ iconUrl: 'https://cdn/icon.png' })),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
