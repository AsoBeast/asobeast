import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ReviewResult } from '../store-providers/types';
import { newReviewRow } from './new-review-row';
import {
  NO_SPIKE_THEMES,
  ReviewSpikeAlerts,
  ReviewSpikeApp,
} from './review-spike-alerts.service';

const REVIEW_INSERT_LOCK = 7_461_029;

export interface ReviewBatch {
  app: ReviewSpikeApp;
  absent: readonly ReviewResult[];
  checkedAt: Date | null;
  judgesSpikes: boolean;
}

async function insertAbsent(
  tx: Prisma.TransactionClient,
  batch: ReviewBatch,
): Promise<ReviewResult[]> {
  const created = await tx.review.createManyAndReturn({
    data: batch.absent.map((review) =>
      newReviewRow(batch.app.id, review, batch.checkedAt),
    ),
    skipDuplicates: true,
    select: { reviewId: true },
  });
  const createdIds = new Set(created.map((row) => row.reviewId));
  return batch.absent.filter((review) => createdIds.has(review.reviewId));
}

@Injectable()
export class ReviewInserts {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spikes: ReviewSpikeAlerts,
  ) {}

  async store(batch: ReviewBatch): Promise<ReviewResult[]> {
    if (batch.absent.length === 0) return [];
    const now = new Date();
    const themes = batch.judgesSpikes
      ? await this.spikes.themesFor(batch.app, batch.absent, now)
      : NO_SPIKE_THEMES;
    return this.prisma.withTransaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${REVIEW_INSERT_LOCK}, hashtext(${batch.app.id}))`;
      const inserted = await insertAbsent(tx, batch);
      if (batch.judgesSpikes && inserted.length > 0) {
        await this.spikes.record(tx, { app: batch.app, inserted, themes, now });
      }
      return inserted;
    });
  }
}
