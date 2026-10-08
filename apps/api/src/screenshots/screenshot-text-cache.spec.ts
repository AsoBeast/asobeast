import type { PrismaService } from '../prisma/prisma.service';
import { ScreenshotTextCache } from './screenshot-text-cache';

const DAY_MS = 24 * 60 * 60 * 1000;

const build = (found: unknown) => {
  const screenshotText = {
    findUnique: jest.fn().mockResolvedValue(found),
    updateMany: jest
      .fn<Promise<{ count: number }>, [{ where: Record<string, unknown> }]>()
      .mockResolvedValue({ count: 1 }),
    upsert: jest
      .fn<Promise<unknown>, [{ where: unknown; create: unknown }]>()
      .mockImplementation(({ create }) => Promise.resolve(create)),
  };
  return {
    cache: new ScreenshotTextCache({
      screenshotText,
    } as unknown as PrismaService),
    screenshotText,
  };
};

describe('ScreenshotTextCache', () => {
  it('misses on an image it has not read under this recipe', async () => {
    const { cache, screenshotText } = build(null);

    await expect(cache.find('a', 'ocr1:eng')).resolves.toBeNull();

    expect(screenshotText.findUnique).toHaveBeenCalledWith({
      where: { assetKey_recipe: { assetKey: 'a', recipe: 'ocr1:eng' } },
    });
  });

  it('returns what was read and leaves a fresh row alone', async () => {
    const { cache, screenshotText } = build({
      status: 'read',
      caption: 'Track every habit',
      usedAt: new Date(),
    });

    await expect(cache.find('a', 'ocr1:eng')).resolves.toEqual({
      status: 'read',
      caption: 'Track every habit',
    });
    expect(screenshotText.updateMany).not.toHaveBeenCalled();
  });

  it('refreshes the use date of a row not used for a day', async () => {
    const { cache, screenshotText } = build({
      status: 'blank',
      caption: null,
      usedAt: new Date(Date.now() - 2 * DAY_MS),
    });

    await cache.find('a', 'ocr1:eng');

    expect(screenshotText.updateMany).toHaveBeenCalledTimes(1);
    expect(screenshotText.updateMany.mock.calls[0][0].where).toMatchObject({
      assetKey: 'a',
      recipe: 'ocr1:eng',
    });
  });

  it('stores a read as one row per image and recipe and hands it back', async () => {
    const { cache, screenshotText } = build(null);

    const stored = await cache.store({
      assetKey: 'a',
      recipe: 'ocr1:eng',
      status: 'read',
      caption: 'Track every habit',
      engine: 'tesseract.js-7',
    });

    expect(stored).toEqual({ status: 'read', caption: 'Track every habit' });
    expect(screenshotText.upsert.mock.calls[0][0].where).toEqual({
      assetKey_recipe: { assetKey: 'a', recipe: 'ocr1:eng' },
    });
  });
});
