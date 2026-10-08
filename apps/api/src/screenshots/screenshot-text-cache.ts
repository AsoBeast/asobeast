import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CachedText {
  status: 'read' | 'blank';
  caption: string | null;
}

export interface CacheEntry extends CachedText {
  assetKey: string;
  recipe: string;
  engine: string;
}

@Injectable()
export class ScreenshotTextCache {
  constructor(private readonly prisma: PrismaService) {}

  async find(assetKey: string, recipe: string): Promise<CachedText | null> {
    const row = await this.prisma.screenshotText.findUnique({
      where: { assetKey_recipe: { assetKey, recipe } },
    });
    if (row === null) return null;
    const now = Date.now();
    if (row.usedAt.getTime() < now - DAY_MS) {
      await this.prisma.screenshotText.updateMany({
        where: { assetKey, recipe, usedAt: { lt: new Date(now - DAY_MS) } },
        data: { usedAt: new Date(now) },
      });
    }
    return { status: row.status as CachedText['status'], caption: row.caption };
  }

  async store(entry: CacheEntry): Promise<CachedText> {
    const { assetKey, recipe, ...text } = entry;
    await this.prisma.screenshotText.upsert({
      where: { assetKey_recipe: { assetKey, recipe } },
      create: { assetKey, recipe, ...text },
      update: { ...text, usedAt: new Date() },
    });
    return { status: text.status, caption: text.caption };
  }
}
