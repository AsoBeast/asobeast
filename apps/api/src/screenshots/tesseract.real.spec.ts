import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { prepareForOcr } from './image-preprocess';
import { readCaption } from './read-caption';
import { TesseractOcrEngine } from './tesseract.engine';

jest.setTimeout(60_000);

describe('the real ocr engine on a marketing screenshot', () => {
  const engine = new TesseractOcrEngine({
    get: () => ['eng'],
  } as unknown as ConfigService<Env, true>);

  afterAll(() => engine.onModuleDestroy());

  const captionOf = async (name: string) =>
    readCaption(
      engine,
      await prepareForOcr(readFileSync(join(__dirname, 'fixtures', name))),
      ['eng'],
    );

  it('reads the headline and not the interface text', async () => {
    const caption = (await captionOf('caption-eng.png'))?.toLowerCase();

    expect(caption).toContain('track every habit');
    expect(caption).toContain('build lasting streaks');
    expect(caption).not.toContain('drink water');
  });

  it('reads a white caption on a colour band', async () => {
    expect(await captionOf('caption-white-band.png')).toBe('Explore');
  });

  it('reads a thin light caption above a bright device', async () => {
    expect((await captionOf('caption-thin-gradient.png'))?.toLowerCase()).toBe(
      'fall asleep to stories',
    );
  });
});
