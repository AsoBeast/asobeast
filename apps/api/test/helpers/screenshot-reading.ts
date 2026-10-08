import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import sharp from 'sharp';
import { QUEUES } from '../../src/jobs/jobs.types';
import type { OcrLine } from '../../src/screenshots/caption-text';
import type { OcrEngine } from '../../src/screenshots/ocr-engine';
import type { OcrLanguage } from '../../src/screenshots/ocr-languages';

export const solidPng = () =>
  sharp({
    create: { width: 540, height: 1170, channels: 3, background: '#ffffff' },
  })
    .png()
    .toBuffer();

export const lines = (text: string) => [
  { text, confidence: 96, left: 0, top: 198, width: 900, height: 102 },
];

export const greyPassEngine = (
  read: (
    image: Buffer,
    languages: readonly OcrLanguage[],
  ) => Promise<OcrLine[]>,
): OcrEngine => ({
  name: 'fake-engine',
  read: (image, languages, thresholding) =>
    thresholding === 'otsu' ? read(image, languages) : Promise.resolve([]),
});

export const until = async (
  check: () => Promise<boolean>,
  timeoutMs = 20_000,
) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('timed out waiting for the screenshots to be read');
};

export const readsFinished = (
  app: INestApplication,
  prisma: PrismaClient,
  snapshotId: string,
) =>
  until(async () => {
    const queue = app.get<Queue>(getQueueToken(QUEUES.SCREENSHOTS), {
      strict: false,
    });
    const pending = await prisma.snapshotScreenshot.count({
      where: { snapshotId, status: 'pending' },
    });
    const busy =
      (await queue.getActiveCount()) + (await queue.getWaitingCount());
    return pending === 0 && busy === 0;
  });
