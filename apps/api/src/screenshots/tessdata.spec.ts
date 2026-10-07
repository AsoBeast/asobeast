import { existsSync, lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { OCR_LANGUAGES } from './ocr-languages';
import { disposeTessdata, tessdataDirectory } from './tessdata';

describe('tessdataDirectory', () => {
  afterEach(() => disposeTessdata());

  it('links one gzipped model per enabled language into a single directory', async () => {
    const directory = await tessdataDirectory(['eng', 'jpn']);

    expect(readdirSync(directory).sort()).toEqual([
      'eng.traineddata.gz',
      'jpn.traineddata.gz',
    ]);
    expect(
      lstatSync(join(directory, 'eng.traineddata.gz')).isSymbolicLink(),
    ).toBe(true);
  });

  it('resolves every bundled language', async () => {
    const directory = await tessdataDirectory(OCR_LANGUAGES);

    expect(readdirSync(directory)).toHaveLength(OCR_LANGUAGES.length);
  });

  it('reuses the directory and removes it on dispose', async () => {
    const first = await tessdataDirectory(['eng']);
    const second = await tessdataDirectory(['eng']);
    expect(second).toBe(first);

    await disposeTessdata();

    expect(existsSync(first)).toBe(false);
  });
});
