import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';

const requireFromHere = createRequire(__filename);

const PACKS = [
  'eng',
  'deu',
  'fra',
  'spa',
  'por',
  'ita',
  'jpn',
  'kor',
  'chi_sim',
  'chi_tra',
  'rus',
  'ara',
  'tha',
];

describe('the on host ocr dependencies', () => {
  it.each(PACKS)(
    'ships the %s language pack as an integer model that gunzips',
    (code) => {
      const manifest = requireFromHere.resolve(
        `@tesseract.js-data/${code}/package.json`,
      );
      const file = join(
        dirname(manifest),
        '4.0.0_best_int',
        `${code}.traineddata.gz`,
      );

      expect(existsSync(file)).toBe(true);
      expect(gunzipSync(readFileSync(file)).byteLength).toBeGreaterThan(
        100_000,
      );
    },
  );

  it('resolves the engine and the wasm core it loads in node', () => {
    const engine = requireFromHere.resolve('tesseract.js');

    expect(engine).toContain('tesseract.js');
    expect(
      createRequire(engine).resolve(
        'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
      ),
    ).toContain('tesseract-core-simd-lstm');
  });

  it('loads the image library with a binary for this platform', async () => {
    const png = await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();

    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  });
});
