import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
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
  ActionUpdateStatus,
  isActionCategory,
  isActionPriority,
  isActionRule,
} from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { actionsSuppressedKey, QUEUES } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { toActionItem } from './actions.mapper';
import {
  ACTIONS_DEFAULT_STATUSES,
  ListActionsQueryDto,
} from './dto/list-actions-query.dto';
import { UpdateActionDto } from './dto/update-action.dto';

const ROW_SELECT = {
  id: true,
  rule: true,
  category: true,
  status: true,
  priority: true,
  impact: true,
  formulaVersion: true,
  country: true,
  store: true,
  evidence: true,
  firstSeenAt: true,
  lastSeenAt: true,
  resolvedAt: true,
  snoozedUntil: true,
  closedAt: true,
  reopenCount: true,
  note: true,
  aiExplanation: true,
  aiModel: true,
  aiGeneratedAt: true,
  app: { select: { id: true, name: true } },
  keyword: { select: { id: true, text: true } },
} satisfies Prisma.ActionItemSelect;

const TOP_RULES_LIMIT = 5;
const DAY_MS = 86_400_000;

@Injectable()
export class ActionsService {
  private readonly logger = new Logger(ActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    @InjectQueue(QUEUES.PIPELINE) private readonly pipeline: Queue,
    private readonly workspace: WorkspaceContext,
  ) {}

  async list(
    query: ListActionsQueryDto,
    appId?: string,
  ): Promise<ActionListResult> {
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
    try {
      const client = await this.pipeline.getBackend().client;
      const stored = Number(
        await client.get(
          actionsSuppressedKey(this.workspace.require('an action summary')),
        ),
      );
      return Number.isInteger(stored) && stored >= 0 ? stored : 0;
    } catch {
      return 0;
    }
  }

  async update(id: string, body: UpdateActionDto): Promise<ActionItem> {
    const current = await this.prisma.actionItem.findFirst({
      where: { id },
      select: { id: true, status: true, reopenCount: true },
    });
    if (!current) {
      throw new NotFoundException('Action not found');
    }

    const snoozedUntil = this.validateSnooze(body);
    if (current.status === 'RESOLVED' && body.status !== 'OPEN') {
      throw new ConflictException(
        'A resolved action is already closed; reopen it instead',
      );
    }

    const row = await this.prisma.actionItem.update({
      where: { id },
      data: {
        status: body.status,
        ...(body.note === undefined ? {} : { note: body.note.trim() }),
        ...this.sideEffects(body.status, current.status, snoozedUntil),
      },
      select: ROW_SELECT,
    });
    return this.map(row);
  }

  private validateSnooze(body: UpdateActionDto): Date | null {
    if (body.status !== 'SNOOZED') {
      if (body.snoozedUntil !== undefined) {
        throw new BadRequestException(
          'snoozedUntil is only valid when status is SNOOZED',
        );
      }
      return null;
    }
    if (body.snoozedUntil === undefined) {
      throw new BadRequestException('snoozedUntil is required to snooze');
    }

    const until = new Date(body.snoozedUntil);
    const now = Date.now();
    if (until.getTime() <= now) {
      throw new BadRequestException('snoozedUntil must be in the future');
    }
    const maxDays = this.config.get('ACTIONS_SNOOZE_MAX_DAYS', {
      infer: true,
    });
    if (until.getTime() > now + maxDays * DAY_MS) {
      throw new BadRequestException(
        `snoozedUntil must be within ${maxDays} days`,
      );
    }
    return until;
  }

  private sideEffects(
    target: ActionUpdateStatus,
    previous: string,
    snoozedUntil: Date | null,
  ): Prisma.ActionItemUpdateInput {
    const now = new Date();
    switch (target) {
      case 'DONE':
        return { closedAt: now, resolvedAt: null, snoozedUntil: null };
      case 'DISMISSED':
        return { closedAt: now, snoozedUntil: null };
      case 'SNOOZED':
        return { snoozedUntil, closedAt: null, resolvedAt: null };
      case 'OPEN':
        return {
          closedAt: null,
          resolvedAt: null,
          snoozedUntil: null,
          ...(previous === 'OPEN' || previous === 'SNOOZED'
            ? {}
            : { reopenCount: { increment: 1 } }),
        };
    }
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
    const latest = await this.prisma.actionItem.aggregate({
      _max: { lastSeenAt: true },
    });
    return latest._max.lastSeenAt?.toISOString() ?? null;
  }

  private map(row: Prisma.ActionItemGetPayload<{ select: typeof ROW_SELECT }>) {
    const item = toActionItem(row);
    if (item.degraded) {
      this.logger.warn(`action ${item.id} has unreadable ${row.rule} evidence`);
    }
    return item;
  }
}
