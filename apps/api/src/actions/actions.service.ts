import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import {
  ACTION_CATEGORIES,
  ActionCategory,
  ActionItem,
  ActionListResult,
  ActionPriorityCounts,
  ActionRule,
  ActionSummary,
  isActionCategory,
  isActionPriority,
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

  async summary(): Promise<ActionSummary> {
    const live = { status: { in: ['OPEN', 'SNOOZED'] } };
    const [byStatus, byPriority, byCategoryRows, byRule, generatedAt] =
      await Promise.all([
        this.prisma.actionItem.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.actionItem.groupBy({
          by: ['priority'],
          where: live,
          _count: { _all: true },
        }),
        this.prisma.actionItem.groupBy({
          by: ['category'],
          where: live,
          _count: { _all: true },
        }),
        this.prisma.actionItem.groupBy({
          by: ['rule'],
          where: live,
          _count: { _all: true },
        }),
        this.generatedAt(),
      ]);
    const suppressedByCap = await this.suppressedByCap();

    const statuses = new Map(
      byStatus.map((row) => [row.status, row._count._all]),
    );
    const priorities: ActionPriorityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const row of byPriority) {
      if (isActionPriority(row.priority)) {
        priorities[row.priority] = row._count._all;
      }
    }

    const byCategory = Object.fromEntries(
      ACTION_CATEGORIES.map((category) => [category, 0]),
    ) as Record<ActionCategory, number>;
    for (const row of byCategoryRows) {
      if (isActionCategory(row.category)) {
        byCategory[row.category] = row._count._all;
      }
    }

    const topRules = byRule
      .filter((row): row is typeof row & { rule: ActionRule } =>
        isActionRule(row.rule),
      )
      .map((row) => ({ rule: row.rule, count: row._count._all }))
      .sort((left, right) => right.count - left.count)
      .slice(0, TOP_RULES_LIMIT);

    return {
      open: statuses.get('OPEN') ?? 0,
      snoozed: statuses.get('SNOOZED') ?? 0,
      byPriority: priorities,
      byCategory,
      topRules,
      generatedAt,
      suppressedByCap,
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
