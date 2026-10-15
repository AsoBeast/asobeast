import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  countChars,
  REVIEW_REPLY_LIMITS,
  ReviewReplyGuidelines,
  ReviewReplyItem,
  ReviewReplyPatchRequest,
} from '@asobeast/shared';
import { storeLabel } from '../alerts/alert-summary';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { toReviewReplyItem } from './review-reply.mapper';

function repliedAtOf(replied: boolean | undefined): Date | null | undefined {
  if (replied === undefined) return undefined;
  return replied ? new Date() : null;
}

function withoutReply(): ReviewReplyItem {
  return {
    text: '',
    tone: null,
    model: null,
    generatedAt: null,
    updatedAt: new Date().toISOString(),
    repliedAt: null,
  };
}

export function assertWithinReplyLimit(store: Store, text: string): void {
  const limit = REVIEW_REPLY_LIMITS[store];
  if (countChars(text) > limit) {
    throw new BadRequestException(
      `A ${storeLabel(store)} reply is at most ${limit} characters`,
    );
  }
}

@Injectable()
export class ReviewRepliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
  ) {}

  async patch(
    appId: string,
    reviewId: string,
    patch: ReviewReplyPatchRequest,
  ): Promise<ReviewReplyItem> {
    if (patch.text === undefined && patch.replied === undefined) {
      throw new BadRequestException('Send the reply text or a replied mark');
    }
    const app = await this.appOf(appId);
    const review = await this.reviewOf(appId, reviewId);

    const text = patch.text?.trim();
    if (text !== undefined) {
      if (text === '' && patch.replied !== true) {
        throw new BadRequestException('A reply needs some text');
      }
      assertWithinReplyLimit(app.store, text);
    }
    const repliedAt = repliedAtOf(patch.replied);

    if (patch.replied === false && text === undefined && !review.reply?.text) {
      const { count } = await this.prisma.reviewReply.deleteMany({
        where: { reviewId, appId, text: '' },
      });
      if (count > 0 || !review.reply) return withoutReply();
    }

    const row = await this.prisma.reviewReply.upsert({
      where: { reviewId },
      create: {
        reviewId,
        appId,
        workspaceId: this.workspace.require('a review reply'),
        text: text ?? '',
        repliedAt: repliedAt ?? null,
      },
      update: { text, repliedAt },
    });
    return toReviewReplyItem(row);
  }

  async remove(appId: string, reviewId: string): Promise<void> {
    await this.appOf(appId);
    await this.reviewOf(appId, reviewId);
    await this.prisma.reviewReply.deleteMany({ where: { reviewId, appId } });
  }

  async guidelines(appId: string): Promise<ReviewReplyGuidelines> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { replyGuidelines: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    return { guidelines: app.replyGuidelines ?? '' };
  }

  async setGuidelines(
    appId: string,
    guidelines: string,
  ): Promise<ReviewReplyGuidelines> {
    const trimmed = guidelines.trim();
    const { count } = await this.prisma.app.updateMany({
      where: { id: appId },
      data: { replyGuidelines: trimmed || null },
    });
    if (count === 0) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    return { guidelines: trimmed };
  }

  private async reviewOf(
    appId: string,
    reviewId: string,
  ): Promise<{ reply: { text: string } | null }> {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, appId },
      select: { reply: { select: { text: true } } },
    });
    if (!review) {
      throw new NotFoundException(`Review ${reviewId} not found`);
    }
    return review;
  }

  private async appOf(appId: string): Promise<{ store: Store }> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { store: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    return app;
  }
}
