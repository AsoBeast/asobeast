import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { nextPlan, type AiCallUsage, type PlanName } from '@asobeast/shared';
import { QuotaService } from '../auth/quota.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { AiAllowanceExceededError } from './ai-allowance.errors';
import { aiPeriodOf, secondsUntil, type AiPeriod } from './ai-period';
import {
  AiClient,
  AiCompletion,
  AiStructuredRequest,
  AiTokenUsage,
  OPENAI_CLIENT,
  UnusableAnswerError,
} from './openai.client';

export const AI_FEATURES = [
  'creativeAnalysis',
  'metadataDrafts',
  'actionExplanation',
] as const;

export type AiFeature = (typeof AI_FEATURES)[number];

export interface AiCallRequest {
  feature: AiFeature;
  appId: string | null;
  userId: string | null;
}

export const AI_NOT_CONFIGURED = 'AI features require OPENAI_API_KEY';

export const SPENDING_STATUSES = ['reserved', 'counted'];

const ALLOWANCE_LOCK = 5_204_117;

const SETTLES_FROM = {
  counted: { not: 'counted' },
  released: 'reserved',
} as const;

type Tx = Prisma.TransactionClient;

@Injectable()
export class AiGateway {
  private readonly logger = new Logger(AiGateway.name);

  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: AiClient | null,
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
    private readonly quota: QuotaService,
  ) {}

  get configured(): boolean {
    return this.client !== null;
  }

  get model(): string | null {
    return this.client?.model ?? null;
  }

  requireModel(): string {
    return this.requireClient().model;
  }

  async spend(
    call: AiCallRequest,
    request: AiStructuredRequest,
  ): Promise<AiCompletion> {
    const id = await this.reserve(call);
    try {
      return await this.charge(id, request);
    } catch (error) {
      await this.release(id);
      throw error;
    }
  }

  async reserve(call: AiCallRequest, now = new Date()): Promise<string> {
    const model = this.requireModel();
    const { plan, limits } = await this.quota.planScope();
    const limit = limits.aiCallsPerMonth;
    const workspaceId = this.workspace.require('an ai call');
    const period = aiPeriodOf(now);

    return this.prisma.withTransaction(async (tx) => {
      if (limit !== null) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ALLOWANCE_LOCK}, hashtext(${workspaceId}))`;
        const used = await spentIn(tx, period);
        if (used >= limit) {
          throw this.exceeded(plan, limit, used, now);
        }
      }
      const { id } = await tx.aiCall.create({
        data: {
          workspaceId,
          ...call,
          model,
          status: 'reserved',
          createdAt: now,
        },
        select: { id: true },
      });
      return id;
    });
  }

  async charge(
    id: string,
    request: AiStructuredRequest,
  ): Promise<AiCompletion> {
    const client = this.requireClient();
    try {
      const completion = await client.structured(request);
      await this.settle(id, 'counted', completion.usage);
      return completion;
    } catch (error) {
      if (error instanceof UnusableAnswerError) {
        await this.settle(id, 'counted', error.usage);
      }
      throw error;
    }
  }

  release(id: string): Promise<void> {
    return this.settle(id, 'released', null);
  }

  async usage(now = new Date()): Promise<AiCallUsage> {
    const { limits } = await this.quota.planScope();
    const period = aiPeriodOf(now);
    return {
      used: await spentIn(this.prisma, period),
      limit: limits.aiCallsPerMonth,
      resetsAt: period.resetsAt.toISOString(),
    };
  }

  private requireClient(): AiClient {
    if (!this.client) throw new ConflictException(AI_NOT_CONFIGURED);
    return this.client;
  }

  private exceeded(
    plan: PlanName,
    limit: number,
    used: number,
    now: Date,
  ): AiAllowanceExceededError {
    const { resetsAt } = aiPeriodOf(now);
    return new AiAllowanceExceededError(
      {
        plan,
        limit,
        used,
        resetsAt: resetsAt.toISOString(),
        upgradeTo: this.quota.enforced ? nextPlan(plan) : null,
      },
      secondsUntil(resetsAt, now),
    );
  }

  private async settle(
    id: string,
    status: 'counted' | 'released',
    usage: AiTokenUsage | null,
  ): Promise<void> {
    await this.prisma.aiCall
      .updateMany({
        where: { id, status: SETTLES_FROM[status] },
        data: { status, settledAt: new Date(), ...usage },
      })
      .catch((error: unknown) =>
        this.logger.error(`could not mark ai call ${id} ${status}`, error),
      );
  }
}

function spentIn(
  client: Tx | PrismaService,
  period: AiPeriod,
): Promise<number> {
  return client.aiCall.count({
    where: {
      status: { in: SPENDING_STATUSES },
      createdAt: { gte: period.start, lt: period.resetsAt },
    },
  });
}
