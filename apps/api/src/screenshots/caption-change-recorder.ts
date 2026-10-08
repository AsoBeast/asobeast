import { Injectable } from '@nestjs/common';
import { ChangesService } from '../changes/changes.service';
import { listingIn } from '../apps/listing';
import { PrismaService } from '../prisma/prisma.service';
import { diffCaptions } from './caption-diff';

interface SettledRow {
  status: string;
  caption: string | null;
  recipe: string | null;
}

interface SnapshotRef {
  id: string;
  appId: string;
  capturedAt: Date;
  listing: { home: string; market: string };
}

const isSettled = (rows: SettledRow[]): boolean =>
  rows.length > 0 &&
  rows.every((row) => row.status === 'read' || row.status === 'blank');

const recipeOf = (rows: SettledRow[]): string | null => {
  const recipes = new Set(rows.map((row) => row.recipe));
  return recipes.size === 1 ? [...recipes][0] : null;
};

const comparable = (before: SettledRow[], after: SettledRow[]): boolean => {
  if (!isSettled(before) || !isSettled(after)) return false;
  const recipe = recipeOf(before);
  return recipe !== null && recipe === recipeOf(after);
};

const captionsOf = (rows: SettledRow[]): string[] =>
  rows.flatMap((row) => (row.caption === null ? [] : [row.caption]));

@Injectable()
export class CaptionChangeRecorder {
  constructor(
    private readonly prisma: PrismaService,
    private readonly changes: ChangesService,
  ) {}

  async record(snapshot: SnapshotRef): Promise<void> {
    const current = await this.rows(snapshot.id);
    if (!isSettled(current)) return;
    const previous = await this.prisma.appSnapshot.findFirst({
      where: {
        appId: snapshot.appId,
        ...listingIn(snapshot.listing.home, snapshot.listing.market),
        capturedAt: { lt: snapshot.capturedAt },
      },
      orderBy: { capturedAt: 'desc' },
      select: { id: true },
    });
    if (previous) {
      await this.compare(snapshot, await this.rows(previous.id), current);
    }
    const next = await this.prisma.appSnapshot.findFirst({
      where: {
        appId: snapshot.appId,
        ...listingIn(snapshot.listing.home, snapshot.listing.market),
        capturedAt: { gt: snapshot.capturedAt },
      },
      orderBy: { capturedAt: 'asc' },
      select: { id: true, capturedAt: true },
    });
    if (next) {
      await this.compare(
        { ...next, appId: snapshot.appId, listing: snapshot.listing },
        current,
        await this.rows(next.id),
      );
    }
  }

  private async compare(
    later: SnapshotRef,
    before: SettledRow[],
    after: SettledRow[],
  ): Promise<void> {
    if (!comparable(before, after)) return;
    const { added, removed } = diffCaptions(
      captionsOf(before),
      captionsOf(after),
    );
    if (added.length === 0 && removed.length === 0) return;
    await this.changes.recordCaptionChange({
      appId: later.appId,
      listing: later.listing,
      since: later.capturedAt,
      before: captionsOf(before),
      after: captionsOf(after),
      added,
      removed,
    });
  }

  private rows(snapshotId: string): Promise<SettledRow[]> {
    return this.prisma.snapshotScreenshot.findMany({
      where: { snapshotId },
      orderBy: { position: 'asc' },
      select: { status: true, caption: true, recipe: true },
    });
  }
}
