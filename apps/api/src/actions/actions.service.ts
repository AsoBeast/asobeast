import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import {
  ACTION_CATEGORIES,
  ACTION_PRIORITIES,
  ACTION_STATUSES,
  ActionItem,
  ActionListResult,
  ActionRule,
  ActionSummary,
  isActionRule,
} from '@asobeast/shared';
import { ensureAppExists } from '../apps/ensure-app';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import {
  actionsGeneratedKey,
  actionsSuppressedKey,
  QUEUES,
} from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { ActionSummaryScope } from './action-summary-scope';
import { CURRENT_SELECT, ActionTransitions } from './action-transitions';
import { ActionRow, ROW_SELECT, toActionItem } from './actions.mapper';
import {
  ACTIONS_DEFAULT_STATUSES,
  ListActionsQueryDto,
} from './dto/list-actions-query.dto';
import { UpdateActionDto } from './dto/update-action.dto';

const TOP_RULES_LIMIT = 5;

@Injectable()
export class ActionsService {
  private readonly logger = new Logger(ActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.PIPELINE) private readonly pipeline: Queue,
    private readonly workspace: WorkspaceContext,
    private readonly transitions: ActionTransitions,
  ) {}

  async list(
    query: ListActionsQueryDto,
    appId?: string,
  ): Promise<ActionListResult> {
    if (appId) {
      await ensureAppExists(this.prisma, appId);
    }
    const where = this.whereFor(query, appId);
    const [rows, total, generatedAt] = await Promise.all([
      this.prisma.actionItem.findMany({
        where,
        select: ROW_SELECT,
        orderBy: [{ impact: 'desc' }, { firstSeenAt: 'asc' }, { id: 'asc' }],
        take: query.limit,
      }),
      this.prisma.actionItem.count({ where }),
      this.generatedAt(),
    ]);

    return { items: rows.map((row) => this.map(row)), total, generatedAt };
  }

  async summary(scope: ActionSummaryScope = {}): Promise<ActionSummary> {
    const live = { ...scope, status: { in: ['OPEN', 'SNOOZED'] } };
    const count = { _count: { _all: true } } as const;
    const [byStatus, byPriority, byCategory, byRule, openByPriority] =
      await Promise.all([
        this.prisma.actionItem.groupBy({
          by: ['status'],
          where: scope,
          ...count,
        }),
        this.prisma.actionItem.groupBy({
          by: ['priority'],
          where: live,
          ...count,
        }),
        this.prisma.actionItem.groupBy({
          by: ['category'],
          where: live,
          ...count,
        }),
        this.prisma.actionItem.groupBy({ by: ['rule'], where: live, ...count }),
        this.prisma.actionItem.groupBy({
          by: ['priority'],
          where: { ...scope, status: 'OPEN' },
          ...count,
        }),
      ]);
    const [generatedAt, suppressedByCap] = await Promise.all([
      this.generatedAt(),
      this.suppressedByCap(),
    ]);
    const statuses = zeroFilled(ACTION_STATUSES, byStatus, (row) => row.status);

    const topRules = byRule
      .filter((row): row is typeof row & { rule: ActionRule } =>
        isActionRule(row.rule),
      )
      .map((row) => ({ rule: row.rule, count: row._count._all }))
      .sort((left, right) => right.count - left.count)
      .slice(0, TOP_RULES_LIMIT);

    return {
      open: statuses.OPEN,
      snoozed: statuses.SNOOZED,
      byPriority: zeroFilled(
        ACTION_PRIORITIES,
        byPriority,
        (row) => row.priority,
      ),
      byCategory: zeroFilled(
        ACTION_CATEGORIES,
        byCategory,
        (row) => row.category,
      ),
      topRules,
      generatedAt,
      suppressedByCap,
      openByPriority: zeroFilled(
        ACTION_PRIORITIES,
        openByPriority,
        (row) => row.priority,
      ),
      byStatus: statuses,
    };
  }

  private async suppressedByCap(): Promise<number> {
    const stored = Number(
      await this.readRunKey(actionsSuppressedKey, 'an action summary'),
    );
    return Number.isInteger(stored) && stored >= 0 ? stored : 0;
  }

  private async readRunKey(
    key: (workspaceId: string) => string,
    operation: string,
  ): Promise<string | null> {
    try {
      const client = await this.pipeline.getBackend().client;
      return await client.get(key(this.workspace.require(operation)));
    } catch {
      return null;
    }
  }

  async update(
    id: string,
    body: UpdateActionDto,
    userId: string,
  ): Promise<ActionItem> {
    const row = await this.prisma.withTransaction(async (tx) => {
      const current = await tx.actionItem.findFirst({
        where: { id },
        select: CURRENT_SELECT,
      });
      if (!current) {
        throw new NotFoundException('Action not found');
      }
      return this.transitions.apply(tx, current, body, userId);
    });
    return this.map(row);
  }

  private whereFor(
    query: ListActionsQueryDto,
    appId?: string,
  ): Prisma.ActionItemWhereInput {
    return {
      status: { in: [...(query.status ?? ACTIONS_DEFAULT_STATUSES)] },
      ...(query.priority ? { priority: { in: query.priority } } : {}),
      ...(query.rule ? { rule: { in: query.rule } } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.country ? { country: query.country } : {}),
      ...(query.store ? { store: query.store } : {}),
      ...((appId ?? query.appId) ? { appId: appId ?? query.appId } : {}),
    };
  }

  private async generatedAt(): Promise<string | null> {
    const recorded = await this.readRunKey(
      actionsGeneratedKey,
      'an action run time',
    );
    if (recorded && !Number.isNaN(Date.parse(recorded))) {
      return new Date(recorded).toISOString();
    }
    const latest = await this.prisma.actionItem.aggregate({
      _max: { lastSeenAt: true },
    });
    return latest._max.lastSeenAt?.toISOString() ?? null;
  }

  private map(row: ActionRow) {
    const item = toActionItem(row);
    if (item.degraded) {
      this.logger.warn(`action ${item.id} has unreadable ${row.rule} evidence`);
    }
    return item;
  }
}

function zeroFilled<K extends string, R extends { _count: { _all: number } }>(
  keys: readonly K[],
  rows: readonly R[],
  keyOf: (row: R) => string,
): Record<K, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<
    K,
    number
  >;
  for (const row of rows) {
    const key = keys.find((candidate) => candidate === keyOf(row));
    if (key !== undefined) counts[key] = row._count._all;
  }
  return counts;
}
