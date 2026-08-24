import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  ACTION_FORMULA_VERSION,
  ACTION_RULE_CATEGORY,
  ActionPriority,
  ActionRule,
  DailyBudget,
  isActionRule,
} from '@asobeast/shared';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ActionContext, ActionContextLoader } from './action-context';
import { actionFingerprint } from './action-fingerprint';
import { scoreImpact } from './action-impact';
import { ExistingAction, nextLifecycle } from './action-lifecycle';
import { ACTION_DETECTORS, DetectedAction } from './action-rule';

export interface OpenedAction {
  id: string;
  workspaceId: string;
  fingerprint: string;
  appId: string;
  keywordId: string | null;
  rule: ActionRule;
  priority: ActionPriority;
  impact: number;
  firstSeenAt: Date;
  reopened: boolean;
}

export interface ActionGenerationResult {
  opened: number;
  refreshed: number;
  reopened: number;
  resolved: number;
  touched: number;
  suppressedByCap: number;
  durationMs: number;
  openedActions: OpenedAction[];
}

interface ScoredDetection extends DetectedAction {
  fingerprint: string;
  impact: number;
  priority: ActionPriority;
}

type ExistingRow = ExistingAction & {
  id: string;
  fingerprint: string;
  rule: string;
};

type ActionWrite = (tx: Prisma.TransactionClient) => Promise<unknown>;

const EMPTY_RESULT = (durationMs: number): ActionGenerationResult => ({
  opened: 0,
  refreshed: 0,
  reopened: 0,
  resolved: 0,
  touched: 0,
  suppressedByCap: 0,
  durationMs,
  openedActions: [],
});

export const emptyActionRun = (): ActionGenerationResult => EMPTY_RESULT(0);

@Injectable()
export class ActionsGenerator {
  private readonly logger = new Logger(ActionsGenerator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly loader: ActionContextLoader,
  ) {}

  async generateForWorkspace(
    budget: DailyBudget,
    now = new Date(),
  ): Promise<ActionGenerationResult> {
    const started = Date.now();
    const context = await this.loader.load(budget, now);

    const { detections, evaluated } = this.runDetectors(context, now);
    const scored = detections.map((detection) => this.score(detection));
    const existing = await this.loadExisting(context.workspaceId);

    const result = await this.reconcile(
      context,
      scored,
      existing,
      evaluated,
      now,
    );
    result.durationMs = Date.now() - started;

    this.logger.log(
      `actions run ${JSON.stringify({
        opened: result.opened,
        refreshed: result.refreshed,
        reopened: result.reopened,
        resolved: result.resolved,
        touched: result.touched,
        suppressedByCap: result.suppressedByCap,
        durationMs: result.durationMs,
      })}`,
    );
    return result;
  }

  private runDetectors(
    context: ActionContext,
    now: Date,
  ): { detections: DetectedAction[]; evaluated: Set<ActionRule> } {
    const detections: DetectedAction[] = [];
    const evaluated = new Set<ActionRule>();

    for (const detector of ACTION_DETECTORS) {
      try {
        detections.push(...detector.detect(context, now));
        evaluated.add(detector.rule);
      } catch (error) {
        this.logger.error(`actions rule ${detector.rule} failed`, error);
      }
    }
    return { detections, evaluated };
  }

  private score(detection: DetectedAction): ScoredDetection {
    const { impact, priority } = scoreImpact(detection.rule, detection.terms);
    return {
      ...detection,
      impact,
      priority,
      fingerprint: actionFingerprint({
        rule: detection.rule,
        appId: detection.appId,
        store: detection.store,
        country: detection.country,
        keywordId: detection.keywordId,
        discriminator: detection.discriminator,
      }),
    };
  }

  private async loadExisting(
    workspaceId: string,
  ): Promise<Map<string, ExistingRow>> {
    const rows = await this.prisma.actionItem.findMany({
      where: { workspaceId },
      select: {
        id: true,
        fingerprint: true,
        rule: true,
        status: true,
        lastSeenAt: true,
        snoozedUntil: true,
        reopenCount: true,
      },
    });
    return new Map(
      rows.map((row) => [
        row.fingerprint,
        {
          id: row.id,
          fingerprint: row.fingerprint,
          rule: row.rule,
          status: row.status as ExistingAction['status'],
          lastSeenAt: row.lastSeenAt,
          snoozedUntil: row.snoozedUntil,
          reopenCount: row.reopenCount,
        },
      ]),
    );
  }

  private capNewDetections(
    scored: ScoredDetection[],
    existing: Map<string, ExistingRow>,
  ): { kept: ScoredDetection[]; suppressedByCap: number } {
    const cap = this.config.get('ACTIONS_MAX_OPEN_PER_APP', { infer: true });
    const openedPerApp = new Map<string, number>();
    const kept: ScoredDetection[] = [];
    let suppressedByCap = 0;

    const ordered = [...scored].sort(
      (left, right) =>
        right.impact - left.impact ||
        left.fingerprint.localeCompare(right.fingerprint),
    );

    for (const detection of ordered) {
      if (existing.has(detection.fingerprint)) {
        kept.push(detection);
        continue;
      }
      const used = openedPerApp.get(detection.appId) ?? 0;
      if (used >= cap) {
        suppressedByCap += 1;
        continue;
      }
      openedPerApp.set(detection.appId, used + 1);
      kept.push(detection);
    }
    return { kept, suppressedByCap };
  }

  private async reconcile(
    context: ActionContext,
    scored: ScoredDetection[],
    existing: Map<string, ExistingRow>,
    evaluated: Set<ActionRule>,
    now: Date,
  ): Promise<ActionGenerationResult> {
    const result = EMPTY_RESULT(0);
    if (scored.length === 0 && existing.size === 0) {
      return result;
    }

    const { kept, suppressedByCap } = this.capNewDetections(scored, existing);
    result.suppressedByCap = suppressedByCap;

    const detected = new Set(kept.map((detection) => detection.fingerprint));
    const writes: ActionWrite[] = [];
    const opened: Array<{ detection: ScoredDetection; reopened: boolean }> = [];

    for (const detection of kept) {
      const row = existing.get(detection.fingerprint) ?? null;
      const outcome = nextLifecycle(row, true, now);

      if (outcome.kind === 'create') {
        writes.push((tx) =>
          this.createWrite(tx, context.workspaceId, detection, now),
        );
        result.opened += 1;
        opened.push({ detection, reopened: false });
        continue;
      }
      if (!row) continue;

      if (outcome.kind === 'reopen') {
        writes.push((tx) =>
          this.updateWrite(tx, row.id, detection, now, {
            status: 'OPEN',
            reopenCount: outcome.reopenCount,
            closedAt: null,
            resolvedAt: null,
            snoozedUntil: null,
          }),
        );
        result.reopened += 1;
        opened.push({ detection, reopened: true });
        continue;
      }
      if (outcome.kind === 'refresh') {
        writes.push((tx) =>
          this.updateWrite(tx, row.id, detection, now, {
            status: outcome.status,
            resolvedAt: null,
            ...(outcome.status === 'OPEN' ? { snoozedUntil: null } : {}),
          }),
        );
        result.refreshed += 1;
        continue;
      }
      if (outcome.kind === 'touch') {
        writes.push((tx) =>
          tx.actionItem.update({
            where: { id: row.id },
            data: { lastSeenAt: now },
          }),
        );
        result.touched += 1;
      }
    }

    for (const row of existing.values()) {
      if (detected.has(row.fingerprint)) continue;
      const rule = row.rule;
      if (!isActionRule(rule) || !evaluated.has(rule)) continue;
      const outcome = nextLifecycle(row, false, now);
      if (outcome.kind !== 'resolve') continue;
      writes.push((tx) =>
        tx.actionItem.update({
          where: { id: row.id },
          data: { status: 'RESOLVED', resolvedAt: now, snoozedUntil: null },
        }),
      );
      result.resolved += 1;
    }

    if (writes.length > 0) {
      await this.prisma.withTransaction(async (tx) => {
        for (const write of writes) {
          await write(tx);
        }
      });
    }
    result.openedActions = await this.resolveOpened(
      context.workspaceId,
      opened,
    );
    return result;
  }

  private createWrite(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    detection: ScoredDetection,
    now: Date,
  ): Promise<unknown> {
    return tx.actionItem.create({
      data: {
        workspaceId,
        appId: detection.appId,
        keywordId: detection.keywordId,
        rule: detection.rule,
        category: ACTION_RULE_CATEGORY[detection.rule],
        store: detection.store,
        country: detection.country,
        fingerprint: detection.fingerprint,
        status: 'OPEN',
        priority: detection.priority,
        impact: detection.impact,
        formulaVersion: ACTION_FORMULA_VERSION,
        evidence: detection.evidence as unknown as Prisma.InputJsonValue,
        firstSeenAt: now,
        lastSeenAt: now,
      },
    });
  }

  private updateWrite(
    tx: Prisma.TransactionClient,
    id: string,
    detection: ScoredDetection,
    now: Date,
    extra: Prisma.ActionItemUpdateInput,
  ): Promise<unknown> {
    return tx.actionItem.update({
      where: { id },
      data: {
        priority: detection.priority,
        impact: detection.impact,
        formulaVersion: ACTION_FORMULA_VERSION,
        evidence: detection.evidence as unknown as Prisma.InputJsonValue,
        lastSeenAt: now,
        ...extra,
      },
    });
  }

  private async resolveOpened(
    workspaceId: string,
    opened: Array<{ detection: ScoredDetection; reopened: boolean }>,
  ): Promise<OpenedAction[]> {
    if (opened.length === 0) return [];
    const rows = await this.prisma.actionItem.findMany({
      where: {
        workspaceId,
        fingerprint: {
          in: opened.map(({ detection }) => detection.fingerprint),
        },
      },
      select: { id: true, fingerprint: true, firstSeenAt: true },
    });
    const byFingerprint = new Map(rows.map((row) => [row.fingerprint, row]));

    return opened.flatMap(({ detection, reopened }) => {
      const row = byFingerprint.get(detection.fingerprint);
      if (!row) return [];
      return [
        {
          id: row.id,
          workspaceId,
          fingerprint: detection.fingerprint,
          appId: detection.appId,
          keywordId: detection.keywordId,
          rule: detection.rule,
          priority: detection.priority,
          impact: detection.impact,
          firstSeenAt: row.firstSeenAt,
          reopened,
        },
      ];
    });
  }
}

export function mergeActionRuns(
  total: ActionGenerationResult,
  run: ActionGenerationResult,
): ActionGenerationResult {
  return {
    opened: total.opened + run.opened,
    refreshed: total.refreshed + run.refreshed,
    reopened: total.reopened + run.reopened,
    resolved: total.resolved + run.resolved,
    touched: total.touched + run.touched,
    suppressedByCap: total.suppressedByCap + run.suppressedByCap,
    durationMs: total.durationMs + run.durationMs,
    openedActions: [...total.openedActions, ...run.openedActions],
  };
}
