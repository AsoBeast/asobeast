import { Injectable } from '@nestjs/common';
import { ChangesService } from '../changes/changes.service';
import { PrismaService } from '../prisma/prisma.service';
import { diffCaptions } from './caption-diff';

interface SettledRow {
  status: string;
  caption: string | null;
}

const isSettled = (rows: SettledRow[]): boolean =>
  rows.length > 0 &&
  rows.every((row) => row.status === 'read' || row.status === 'blank');

const captionsOf = (rows: SettledRow[]): string[] =>
  rows.flatMap((row) => (row.caption === null ? [] : [row.caption]));

@Injectable()
export class CaptionChangeRecorder {
  constructor(
    private readonly prisma: PrismaService,
    private readonly changes: ChangesService,
  ) {}

  async record(snapshot: {
    id: string;
    appId: string;
    capturedAt: Date;
  }): Promise<void> {
    const current = await this.rows(snapshot.id);
    if (!isSettled(current)) return;
    const previous = await this.prisma.appSnapshot.findFirst({
      where: { appId: snapshot.appId, capturedAt: { lt: snapshot.capturedAt } },
      orderBy: { capturedAt: 'desc' },
      select: { id: true },
    });
    if (!previous) return;
    const before = await this.rows(previous.id);
    if (!isSettled(before)) return;

    const { added, removed } = diffCaptions(
      captionsOf(before),
      captionsOf(current),
    );
    if (added.length === 0 && removed.length === 0) return;
    await this.changes.recordCaptionChange({
      appId: snapshot.appId,
      since: snapshot.capturedAt,
      before: captionsOf(before),
      after: captionsOf(current),
      added,
      removed,
    });
  }

  private rows(snapshotId: string): Promise<SettledRow[]> {
    return this.prisma.snapshotScreenshot.findMany({
      where: { snapshotId },
      orderBy: { position: 'asc' },
      select: { status: true, caption: true },
    });
  }
}
