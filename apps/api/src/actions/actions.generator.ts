import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActionPriority,
  ActionRule,
  DailyBudget,
  isActionRule,
} from '@asobeast/shared';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ActionContext, ActionContextLoader } from './action-context';
import { ActionEventInput, ActionEventRecorder } from './action-events';
import { lockActions } from './action-locks';
import { actionFingerprint } from './action-fingerprint';
import { scoreImpact } from './action-impact';
import { ExistingAction } from './action-lifecycle';
import { ACTION_DETECTORS, DetectedAction } from './action-rule';
import {
  ActionWrite,
  ExistingRow,
  lifecycleWrite,
  missedWrite,
  MissedWrite,
  PlannedWrite,
  ScoredDetection,
} from './action-writes';
import { priorityOf } from './actions.mapper';

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

interface SurfacedDetection {
  detection: ScoredDetection;
  reopened: boolean;
}

interface PlannedStep {
  actionId: string | null;
  write: ActionWrite;
  counter: PlannedWrite['counter'] | MissedWrite['counter'];
  surfaced: SurfacedDetection | null;
}

export interface ActionGenerationResult {
  opened: number;
  refreshed: number;
  reopened: number;
  resolved: number;
  verified: number;
  touched: number;
  suppressedByCap: number;
  durationMs: number;
  openedActions: OpenedAction[];
}

const EMPTY_RESULT = (durationMs: number): ActionGenerationResult => ({
  opened: 0,
  refreshed: 0,
  reopened: 0,
  resolved: 0,
  verified: 0,
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
    private readonly recorder: ActionEventRecorder,
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
        verified: result.verified,
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
        appId: true,
        status: true,
        priority: true,
        impact: true,
        lastSeenAt: true,
        closedAt: true,
        verifiedAt: true,
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
          appId: row.appId,
          priority: priorityOf(row.priority),
          impact: row.impact,
          status: row.status as ExistingAction['status'],
          lastSeenAt: row.lastSeenAt,
          closedAt: row.closedAt,
          verifiedAt: row.verifiedAt,
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

    const live = scored.filter((detection) => !detection.withheld);
    const { kept, suppressedByCap } = this.capNewDetections(live, existing);
    result.suppressedByCap = suppressedByCap;

    const detected = new Set(
      [...kept, ...scored.filter((detection) => detection.withheld)].map(
        (detection) => detection.fingerprint,
      ),
    );
    const steps: PlannedStep[] = [];

    for (const detection of kept) {
      const row = existing.get(detection.fingerprint) ?? null;
      const planned = lifecycleWrite(context.workspaceId, row, detection, now);
      if (planned) steps.push(detectionStep(planned, row, detection));
    }

    for (const row of existing.values()) {
      if (detected.has(row.fingerprint)) continue;
      const rule = row.rule;
      if (!isActionRule(rule) || !evaluated.has(rule)) continue;
      const planned = missedWrite(context.workspaceId, row, now);
      if (!planned) continue;
      steps.push({ ...planned, actionId: row.id, surfaced: null });
    }

    const applied = await this.applySteps(steps);
    for (const step of applied) result[step.counter] += 1;
    result.openedActions = await this.resolveOpened(
      context.workspaceId,
      applied.flatMap((step) => (step.surfaced ? [step.surfaced] : [])),
    );
    return result;
  }

  private async applySteps(steps: PlannedStep[]): Promise<PlannedStep[]> {
    if (steps.length === 0) return [];
    return this.prisma.withTransaction(async (tx) => {
      await lockActions(
        tx,
        steps.flatMap((step) => step.actionId ?? []),
      );
      const events: ActionEventInput[] = [];
      const applied: PlannedStep[] = [];
      for (const step of steps) {
        if (await step.write(tx, events)) applied.push(step);
      }
      await this.recorder.record(tx, events);
      return applied;
    });
  }

  private async resolveOpened(
    workspaceId: string,
    opened: SurfacedDetection[],
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

function detectionStep(
  planned: PlannedWrite,
  row: ExistingRow | null,
  detection: ScoredDetection,
): PlannedStep {
  const surfaced =
    planned.counter === 'opened' || planned.counter === 'reopened';
  return {
    ...planned,
    actionId: row?.id ?? null,
    surfaced: surfaced
      ? { detection, reopened: planned.counter === 'reopened' }
      : null,
  };
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
    verified: total.verified + run.verified,
    touched: total.touched + run.touched,
    suppressedByCap: total.suppressedByCap + run.suppressedByCap,
    durationMs: total.durationMs + run.durationMs,
    openedActions: [...total.openedActions, ...run.openedActions],
  };
}
