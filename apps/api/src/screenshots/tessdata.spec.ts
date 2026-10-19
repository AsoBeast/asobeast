import { existsSync, lstatSync, readdirSync } from 'node:fs';
import fsPromises from 'node:fs/promises';
import { join } from 'node:path';
import { OCR_LANGUAGES, type OcrLanguage } from './ocr-languages';
import { disposeTessdata, tessdataDirectory } from './tessdata';

const nextMacrotask = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

describe('tessdataDirectory', () => {
  afterEach(async () => {
    jest.restoreAllMocks();
    await disposeTessdata();
  });

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

  it('tries again after a failed link', async () => {
    await expect(
      tessdataDirectory(['eng', 'klingon' as OcrLanguage]),
    ).rejects.toThrow();

    const directory = await tessdataDirectory(['eng']);

    expect(readdirSync(directory)).toEqual(['eng.traineddata.gz']);
  });

  it('issues no symlink when a model cannot be resolved', async () => {
    const links = jest.spyOn(fsPromises, 'symlink');

    await expect(
      tessdataDirectory(['eng', 'klingon' as OcrLanguage]),
    ).rejects.toThrow();

    expect(links).not.toHaveBeenCalled();
  });

  it('waits for every symlink before cleaning up a failed link', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let linked = 0;
    let bothLinked: () => void = () => {};
    const bothLinkedPromise = new Promise<void>((resolve) => {
      bothLinked = resolve;
    });
    jest
      .spyOn(fsPromises, 'symlink')
      .mockImplementation(async (_target, path) => {
        linked += 1;
        if (linked === 2) bothLinked();
        if (String(path).endsWith('rus.traineddata.gz')) {
          throw new Error('link failed');
        }
        await gate;
      });
    const removals = jest.spyOn(fsPromises, 'rm');

    const attempt = tessdataDirectory(['eng', 'rus']);
    const rejectionHandled = expect(attempt).rejects.toThrow('link failed');
    await bothLinkedPromise;
    await nextMacrotask();
    expect(removals).not.toHaveBeenCalled();

    release();
    await rejectionHandled;
    expect(removals).toHaveBeenCalledTimes(1);
  });

  it('leaves no directory behind after a failed link', async () => {
    const created = jest.spyOn(fsPromises, 'mkdtemp');

    await expect(
      tessdataDirectory(['eng', 'klingon' as OcrLanguage]),
    ).rejects.toThrow();

    expect(created).toHaveBeenCalledTimes(1);
    const directory = await (created.mock.results[0].value as Promise<string>);
    expect(existsSync(directory)).toBe(false);
  });
});
