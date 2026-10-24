import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  REVIEW_REPLY_LIMITS,
  ReviewReplyDraftRequest,
  ReviewReplyDraftResult,
  ReviewReplyItem,
  ReviewReplyTone,
} from '@asobeast/shared';
import { AiGateway } from '../ai/ai-gateway.service';
import { HOME_LISTING, NEWEST_FIRST } from '../apps/listing';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { releaseNotesFor } from '../store-providers/raw-facts';
import {
  buildReplyContext,
  DRAFT_MAX_OUTPUT_TOKENS,
  fitReply,
  foreignContacts,
  parseReplyOutput,
  REPLY_SCHEMA,
  ReplyContext,
  SYSTEM_PROMPT,
} from './review-reply-drafts';
import { toReviewReplyItem, WITH_POSTER } from './review-reply.mapper';

const VOICE_EXAMPLES = 3;

interface Draft {
  text: string;
  tone: ReviewReplyTone;
  model: string;
}

@Injectable()
export class ReviewReplyAssistant {
  constructor(
    private readonly ai: AiGateway,
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
  ) {}

  async draft(
    appId: string,
    reviewId: string,
    request: ReviewReplyDraftRequest,
    userId: string,
  ): Promise<ReviewReplyDraftResult> {
    const model = this.ai.requireModel();
    const context = await this.contextOf(appId, reviewId, request);

    const { output } = await this.ai.spend(
      { feature: 'reviewReply', appId, userId },
      {
        system: SYSTEM_PROMPT,
        content: [{ type: 'text', text: buildReplyContext(context) }],
        schema: REPLY_SCHEMA,
        maxOutputTokens: DRAFT_MAX_OUTPUT_TOKENS,
      },
    );

    const parsed = parseReplyOutput(output);
    if (!parsed) {
      throw new BadGatewayException(
        'The assistant did not return a reply; please try again.',
      );
    }
    const { text, truncated } = fitReply(parsed.reply, context.limit);
    const owned = [context.guidelines ?? '', context.instructions ?? ''];
    if (foreignContacts(text, owned).length > 0) {
      throw new BadGatewayException(
        'The assistant added a link or an address that is not in the reply guidelines; please try again.',
      );
    }
    const reply = await this.save(appId, reviewId, {
      text,
      tone: context.tone,
      model,
    });
    return { reply, language: parsed.language, truncated };
  }

  private async contextOf(
    appId: string,
    reviewId: string,
    request: ReviewReplyDraftRequest,
  ): Promise<ReplyContext> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { store: true, name: true, replyGuidelines: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, appId },
    });
    if (!review) {
      throw new NotFoundException(`Review ${reviewId} not found`);
    }
    const [snapshot, examples] = await Promise.all([
      this.prisma.appSnapshot.findFirst({
        where: { appId, ...HOME_LISTING },
        orderBy: NEWEST_FIRST,
        select: { version: true, raw: true },
      }),
      this.prisma.review.findMany({
        where: { appId, id: { not: reviewId }, replyText: { not: null } },
        orderBy: { repliedAt: { sort: 'desc', nulls: 'last' } },
        take: VOICE_EXAMPLES,
        select: { replyText: true },
      }),
    ]);
    return {
      store: app.store,
      appName: app.name,
      review: { ...review, storeReplyText: review.replyText },
      currentVersion: snapshot?.version ?? null,
      releaseNotes: snapshot ? releaseNotesFor(app.store, snapshot.raw) : null,
      guidelines: app.replyGuidelines,
      examples: examples.flatMap((row) =>
        row.replyText ? [row.replyText] : [],
      ),
      tone: request.tone ?? 'neutral',
      instructions: request.instructions?.trim() || undefined,
      limit: REVIEW_REPLY_LIMITS[app.store],
    };
  }

  private async save(
    appId: string,
    reviewId: string,
    draft: Draft,
  ): Promise<ReviewReplyItem> {
    const generated = { ...draft, generatedAt: new Date() };
    const row = await this.prisma.reviewReply.upsert({
      where: { reviewId },
      create: {
        reviewId,
        appId,
        workspaceId: this.workspace.require('a review reply draft'),
        ...generated,
      },
      update: generated,
      include: WITH_POSTER,
    });
    return toReviewReplyItem(row);
  }
}
