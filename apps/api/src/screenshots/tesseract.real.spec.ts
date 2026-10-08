import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { prepareForOcr } from './image-preprocess';
import { selectCaption } from './caption-text';
import { TesseractOcrEngine } from './tesseract.engine';

jest.setTimeout(60_000);

describe('the real ocr engine on a marketing screenshot', () => {
  const engine = new TesseractOcrEngine({
    get: () => ['eng'],
  } as unknown as ConfigService<Env, true>);

  afterAll(() => engine.onModuleDestroy());

  it('reads the headline and not the interface text', async () => {
    const bytes = readFileSync(join(__dirname, 'fixtures', 'caption-eng.png'));
    const prepared = await prepareForOcr(bytes);

    const lines = await engine.read(prepared.image, ['eng']);
    const caption = selectCaption(lines, prepared.height);

    expect(caption?.toLowerCase()).toContain('track every habit');
    expect(caption?.toLowerCase()).toContain('build lasting streaks');
    expect(caption?.toLowerCase()).not.toContain('drink water');
  });
});
