import { Prisma } from '@prisma/client';
import {
  ACTION_FORMULA_VERSION,
  ACTION_RULE_CATEGORY,
  ActionEventType,
  ActionPriority,
  ActionStatus,
} from '@asobeast/shared';
import { ActionEventInput } from './action-events';
import { ExistingAction, nextLifecycle } from './action-lifecycle';
import { DetectedAction } from './action-rule';

export interface ScoredDetection extends DetectedAction {
  fingerprint: string;
  impact: number;
  priority: ActionPriority;
}

export type ExistingRow = ExistingAction & {
  id: string;
  fingerprint: string;
  rule: string;
  appId: string;
  priority: ActionPriority;
  impact: number;
};

export type ActionWrite = (
  tx: Prisma.TransactionClient,
  events: ActionEventInput[],
) => Promise<boolean>;

type LifecycleCounter = 'opened' | 'reopened' | 'refreshed' | 'touched';

export interface PlannedWrite {
  write: ActionWrite;
  counter: LifecycleCounter;
}

interface SystemEvent {
  actionId: string;
  appId: string;
  type: ActionEventType;
  status: ActionStatus;
  priority: ActionPriority;
  impact: number;
}

function unchangedSinceRead(row: ExistingRow): Prisma.ActionItemWhereInput {
  return {
    id: row.id,
    status: row.status,
    reopenCount: row.reopenCount,
    snoozedUntil: row.snoozedUntil,
    closedAt: row.closedAt,
    verifiedAt: row.verifiedAt,
  };
}

async function updateIfUnchanged(
  tx: Prisma.TransactionClient,
  row: ExistingRow,
  data: Prisma.ActionItemUpdateManyMutationInput,
): Promise<boolean> {
  const { count } = await tx.actionItem.updateMany({
    where: unchangedSinceRead(row),
    data,
  });
  return count === 1;
}

export function lifecycleWrite(
  workspaceId: string,
  row: ExistingRow | null,
  detection: ScoredDetection,
  now: Date,
): PlannedWrite | null {
  const outcome = nextLifecycle(row, true, now);
  const event = (actionId: string, type: ActionEventType): ActionEventInput =>
    systemEvent(
      workspaceId,
      {
        actionId,
        appId: detection.appId,
        type,
        status: 'OPEN',
        priority: detection.priority,
        impact: detection.impact,
      },
      now,
    );

  if (outcome.kind === 'create') {
    return {
      counter: 'opened',
      write: async (tx, events) => {
        const { id } = await createWrite(tx, workspaceId, detection, now);
        events.push(event(id, 'opened'));
        return true;
      },
    };
  }
  if (!row) return null;

  if (outcome.kind === 'reopen') {
    return {
      counter: 'reopened',
      write: async (tx, events) => {
        const applied = await updateWrite(tx, row, detection, now, {
          status: 'OPEN',
          reopenCount: outcome.reopenCount,
          closedAt: null,
          verifiedAt: null,
          resolvedAt: null,
          snoozedUntil: null,
          aiExplanation: null,
          aiModel: null,
          aiGeneratedAt: null,
        });
        if (applied) events.push(event(row.id, 'reopened'));
        return applied;
      },
    };
  }
  if (outcome.kind === 'refresh') {
    const woke = row.status === 'SNOOZED' && outcome.status === 'OPEN';
    return {
      counter: 'refreshed',
      write: async (tx, events) => {
        const applied = await updateWrite(tx, row, detection, now, {
          status: outcome.status,
          resolvedAt: null,
          ...(outcome.status === 'OPEN' ? { snoozedUntil: null } : {}),
        });
        if (applied && woke) events.push(event(row.id, 'woke'));
        return applied;
      },
    };
  }
  if (outcome.kind === 'touch') {
    return {
      counter: 'touched',
      write: (tx) => updateIfUnchanged(tx, row, { lastSeenAt: now }),
    };
  }
  return null;
}

const MISSED_WRITES = {
  resolve: {
    counter: 'resolved',
    type: 'resolved',
    status: 'RESOLVED',
    data: (now: Date) => ({
      status: 'RESOLVED',
      resolvedAt: now,
      snoozedUntil: null,
    }),
  },
  verify: {
    counter: 'verified',
    type: 'verified',
    status: 'DONE',
    data: (now: Date) => ({ verifiedAt: now }),
  },
} as const;

export interface MissedWrite {
  write: ActionWrite;
  counter: 'resolved' | 'verified';
}

export function missedWrite(
  workspaceId: string,
  row: ExistingRow,
  now: Date,
): MissedWrite | null {
  const outcome = nextLifecycle(row, false, now);
  if (outcome.kind !== 'resolve' && outcome.kind !== 'verify') return null;
  const planned = MISSED_WRITES[outcome.kind];
  return {
    counter: planned.counter,
    write: async (tx, events) => {
      const applied = await updateIfUnchanged(tx, row, planned.data(now));
      if (!applied) return false;
      events.push(
        systemEvent(
          workspaceId,
          {
            actionId: row.id,
            appId: row.appId,
            type: planned.type,
            status: planned.status,
            priority: row.priority,
            impact: row.impact,
          },
          now,
        ),
      );
      return true;
    },
  };
}

function createWrite(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  detection: ScoredDetection,
  now: Date,
): Promise<{ id: string }> {
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
    select: { id: true },
  });
}

function updateWrite(
  tx: Prisma.TransactionClient,
  row: ExistingRow,
  detection: ScoredDetection,
  now: Date,
  extra: Prisma.ActionItemUpdateManyMutationInput,
): Promise<boolean> {
  return updateIfUnchanged(tx, row, {
    priority: detection.priority,
    impact: detection.impact,
    formulaVersion: ACTION_FORMULA_VERSION,
    evidence: detection.evidence as unknown as Prisma.InputJsonValue,
    lastSeenAt: now,
    ...extra,
  });
}

function systemEvent(
  workspaceId: string,
  event: SystemEvent,
  now: Date,
): ActionEventInput {
  return {
    workspaceId,
    ...event,
    actor: 'system',
    userId: null,
    snoozedUntil: null,
    reason: null,
    occurredAt: now,
  };
}
