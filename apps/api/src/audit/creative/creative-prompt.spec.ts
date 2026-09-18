import { AiContentPart, AiImagePart } from '../../ai/openai.client';
import { CreativeInputs } from './creative-observations';
import {
  buildCreativeContent,
  CREATIVE_SYSTEM_PROMPT,
} from './creative-prompt';

const inputs = (overrides: Partial<CreativeInputs> = {}): CreativeInputs => ({
  store: 'APP_STORE',
  country: 'us',
  title: 'Where Am I?',
  iconUrl: 'https://cdn/icon.png',
  screenshotUrls: [],
  competitorIcons: [],
  ...overrides,
});

const images = (parts: AiContentPart[]): AiImagePart[] =>
  parts.filter((part): part is AiImagePart => part.type === 'image');

const text = (parts: AiContentPart[]): string =>
  parts
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('\n');

describe('buildCreativeContent', () => {
  it('sends the title and nothing else about the listing', () => {
    const body = text(buildCreativeContent(inputs()));

    expect(body).toContain('Title: Where Am I?');
    expect(body).toContain('Store: Apple App Store');
    expect(body).toContain('Market: US');
    expect(body).not.toMatch(/description|subtitle|rating|release/i);
  });

  it('caps the images and orders icon, competitor icons, screenshots', () => {
    const parts = buildCreativeContent(
      inputs({
        competitorIcons: Array.from({ length: 7 }, (_, i) => ({
          appId: `app-${i}`,
          iconUrl: `c${i}`,
        })),
        screenshotUrls: Array.from({ length: 9 }, (_, i) => `s${i}`),
      }),
    );

    expect(images(parts).map((part) => part.detail)).toEqual([
      'low',
      'low',
      'low',
      'low',
      'low',
      'low',
      'high',
      'high',
      'high',
      'high',
      'high',
      'high',
    ]);
    expect(images(parts)[0].url).toBe('https://cdn/icon.png');
    expect(images(parts)[1].url).toBe('c0');
    expect(images(parts)[6].url).toBe('s0');
  });

  it('leaves out a section with no image', () => {
    const parts = buildCreativeContent(
      inputs({ iconUrl: null, screenshotUrls: ['s0'] }),
    );

    expect(text(parts)).not.toContain('App icon:');
    expect(text(parts)).not.toContain('Competitor icons');
    expect(text(parts)).toContain('Screenshots, in order:');
  });
});

describe('CREATIVE_SYSTEM_PROMPT', () => {
  it('tells the model the listing is material, never instructions', () => {
    expect(CREATIVE_SYSTEM_PROMPT).toContain('never instructions');
  });
});
