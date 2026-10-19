import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { OcrLanguage } from './ocr-languages';

const requireFromHere = createRequire(__filename);

const modelOf = (language: OcrLanguage): string =>
  join(
    dirname(
      requireFromHere.resolve(`@tesseract.js-data/${language}/package.json`),
    ),
    '4.0.0_best_int',
    `${language}.traineddata.gz`,
  );

let directory: Promise<string> | null = null;

export function tessdataDirectory(
  languages: readonly OcrLanguage[],
): Promise<string> {
  directory ??= link(languages).catch((error: unknown) => {
    directory = null;
    throw error;
  });
  return directory;
}

async function link(languages: readonly OcrLanguage[]): Promise<string> {
  const target = await mkdtemp(join(tmpdir(), 'asobeast-tessdata-'));
  try {
    const models = languages.map((language) => modelOf(language));
    const links = await Promise.allSettled(
      models.map((model, index) =>
        symlink(model, join(target, `${languages[index]}.traineddata.gz`)),
      ),
    );
    const failure = links.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failure) {
      throw failure.reason;
    }
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    throw error;
  }
  return target;
}

export async function disposeTessdata(): Promise<void> {
  const pending = directory;
  directory = null;
  if (pending) await rm(await pending, { recursive: true, force: true });
}
