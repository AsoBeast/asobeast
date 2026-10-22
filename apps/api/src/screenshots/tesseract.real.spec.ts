import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { prepareForOcr } from './image-preprocess';
import { readCaption } from './read-caption';
import * as tessdata from './tessdata';
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

describe('the real ocr engine with a damaged language pack', () => {
  const intact = readFileSync(
    join(
      dirname(
        createRequire(__filename).resolve(
          '@tesseract.js-data/eng/package.json',
        ),
      ),
      '4.0.0_best_int',
      'eng.traineddata.gz',
    ),
  );
  const damaged: Record<string, Buffer> = {
    truncated: intact.subarray(0, intact.length / 2),
    'not gzip': Buffer.from('not a language pack'),
    empty: Buffer.alloc(0),
  };
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'asobeast-damaged-'));
    jest.spyOn(tessdata, 'tessdataDirectory').mockResolvedValue(directory);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
  });

  it.each(Object.keys(damaged))(
    'fails the read of a %s pack instead of the process',
    async (kind) => {
      await writeFile(join(directory, 'eng.traineddata.gz'), damaged[kind]);
      const engine = new TesseractOcrEngine({
        get: () => ['eng'],
      } as unknown as ConfigService<Env, true>);
      const [pass] = (
        await prepareForOcr(
          readFileSync(join(__dirname, 'fixtures', 'caption-eng.png')),
        )
      ).passes;

      await expect(
        engine.read(pass.image, ['eng'], pass.thresholding),
      ).rejects.toThrow();
      await engine.onModuleDestroy();
    },
  );
});
