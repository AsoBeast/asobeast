import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ReviewResult } from '../store-providers/types';
import { newReviewRow } from './new-review-row';

export interface ReviewBatch {
  appId: string;
  absent: readonly ReviewResult[];
  checkedAt: Date | null;
}

@Injectable()
export class ReviewInserts {
  constructor(private readonly prisma: PrismaService) {}

  async store(batch: ReviewBatch): Promise<ReviewResult[]> {
    if (batch.absent.length === 0) return [];
    const created = await this.prisma.review.createManyAndReturn({
      data: batch.absent.map((review) =>
        newReviewRow(batch.appId, review, batch.checkedAt),
      ),
      skipDuplicates: true,
      select: { reviewId: true },
    });
    const createdIds = new Set(created.map((row) => row.reviewId));
    return batch.absent.filter((review) => createdIds.has(review.reviewId));
  }
}
