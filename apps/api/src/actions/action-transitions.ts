import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  ActionEventType,
  ActionUpdateRequest,
  ActionUpdateStatus,
} from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { ActionEventInput, ActionEventRecorder } from './action-events';
import { ActionRow, priorityOf, ROW_SELECT } from './actions.mapper';

export const CURRENT_SELECT = {
  id: true,
  appId: true,
  status: true,
  priority: true,
  impact: true,
  reopenCount: true,
  snoozedUntil: true,
  closedAt: true,
} satisfies Prisma.ActionItemSelect;

export type CurrentAction = Prisma.ActionItemGetPayload<{
  select: typeof CURRENT_SELECT;
}>;

export const ACTION_REVERT_WINDOW_MINUTES = 10;

const REVERT_EVENT_SELECT = {
  id: true,
  type: true,
  actor: true,
  userId: true,
  status: true,
  snoozedUntil: true,
  occurredAt: true,
} satisfies Prisma.ActionEventSelect;

type RevertEvent = Prisma.ActionEventGetPayload<{
  select: typeof REVERT_EVENT_SELECT;
}>;

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

@Injectable()
export class ActionTransitions {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly workspace: WorkspaceContext,
    private readonly recorder: ActionEventRecorder,
  ) {}

  async apply(
    tx: Prisma.TransactionClient,
    current: CurrentAction,
    body: ActionUpdateRequest,
    userId: string,
  ): Promise<ActionRow> {
    const { row, event } = await this.transition(tx, current, body, userId);
    await this.recorder.record(tx, event ? [event] : []);
    return row;
  }

  async applyMany(
    tx: Prisma.TransactionClient,
    currents: readonly CurrentAction[],
    body: ActionUpdateRequest,
    userId: string,
  ): Promise<{ rows: ActionRow[]; conflicts: string[] }> {
    const rows: ActionRow[] = [];
    const conflicts: string[] = [];
    const events: ActionEventInput[] = [];
    for (const current of currents) {
      try {
        const { row, event } = await this.transition(tx, current, body, userId);
        rows.push(row);
        if (event) events.push(event);
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
        conflicts.push(current.id);
      }
    }
    await this.recorder.record(tx, events);
    return { rows, conflicts };
  }

  private async transition(
    tx: Prisma.TransactionClient,
    current: CurrentAction,
    body: ActionUpdateRequest,
    userId: string,
  ): Promise<{ row: ActionRow; event: ActionEventInput | null }> {
    validateShape(body);
    if (body.revert) {
      return {
        row: await this.revert(tx, current, body, userId),
        event: null,
      };
    }
    const note = body.note === undefined ? {} : { note: body.note.trim() };
    if (isNoteOnly(current, body)) {
      const row = await tx.actionItem.update({
        where: { id: current.id },
        data: note,
        select: ROW_SELECT,
      });
      return { row, event: null };
    }

    const now = new Date();
    const snoozedUntil = this.snoozeDate(body, now);
    if (current.status === 'RESOLVED' && body.status !== 'OPEN') {
      throw new ConflictException(
        'A resolved action is already closed; reopen it instead',
      );
    }

    const row = await tx.actionItem.update({
      where: { id: current.id },
      data: {
        status: body.status,
        ...note,
        ...sideEffects(body.status, snoozedUntil, now),
        ...(countsAsReopen(current.status, body.status)
          ? { reopenCount: { increment: 1 } }
          : {}),
      },
      select: ROW_SELECT,
    });
    const type = transitionEvent(current.status, body.status);
    return {
      row,
      event: type && {
        workspaceId: this.workspace.require('an action update'),
        actionId: current.id,
        appId: current.appId,
        type,
        actor: 'user',
        userId,
        status: body.status,
        priority: priorityOf(current.priority),
        impact: current.impact,
        snoozedUntil,
        reason: body.reason ?? null,
        occurredAt: now,
      },
    };
  }

  private async revert(
    tx: Prisma.TransactionClient,
    current: CurrentAction,
    body: ActionUpdateRequest,
    userId: string,
  ): Promise<ActionRow> {
    const now = new Date();
    const [latest, ...earlier] = await tx.actionEvent.findMany({
      where: { actionId: current.id },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: 3,
      select: REVERT_EVENT_SELECT,
    });
    const windowStart =
      now.getTime() - ACTION_REVERT_WINDOW_MINUTES * MINUTE_MS;
    if (
      latest?.actor !== 'user' ||
      latest.userId !== userId ||
      latest.occurredAt.getTime() < windowStart
    ) {
      throw new ConflictException('Nothing recent to undo on this action');
    }
    if (body.status !== (earlier[0]?.status ?? 'OPEN')) {
      throw new ConflictException('Undo must restore the previous status');
    }

    const row = await tx.actionItem.update({
      where: { id: current.id },
      data: {
        status: body.status,
        ...restoredState(body.status, earlier),
        ...(latest.type === 'reopened'
          ? { reopenCount: { decrement: 1 } }
          : {}),
      },
      select: ROW_SELECT,
    });
    await tx.actionEvent.delete({ where: { id: latest.id } });
    return row;
  }

  private snoozeDate(body: ActionUpdateRequest, now: Date): Date | null {
    if (body.status !== 'SNOOZED' || body.snoozedUntil === undefined) {
      return null;
    }
    const until = new Date(body.snoozedUntil);
    if (until.getTime() <= now.getTime()) {
      throw new BadRequestException('snoozedUntil must be in the future');
    }
    const maxDays = this.config.get('ACTIONS_SNOOZE_MAX_DAYS', {
      infer: true,
    });
    if (until.getTime() > now.getTime() + maxDays * DAY_MS) {
      throw new BadRequestException(
        `snoozedUntil must be within ${maxDays} days`,
      );
    }
    return until;
  }
}

function validateShape(body: ActionUpdateRequest): void {
  if (body.reason !== undefined && body.status !== 'DISMISSED') {
    throw new BadRequestException(
      'reason is only valid when status is DISMISSED',
    );
  }
  if (body.status !== 'SNOOZED' && body.snoozedUntil !== undefined) {
    throw new BadRequestException(
      'snoozedUntil is only valid when status is SNOOZED',
    );
  }
  if (body.status === 'SNOOZED' && body.snoozedUntil === undefined) {
    throw new BadRequestException('snoozedUntil is required to snooze');
  }
}

function isNoteOnly(
  current: CurrentAction,
  body: ActionUpdateRequest,
): boolean {
  if (body.status !== current.status) return false;
  if (body.status === 'SNOOZED') {
    return (
      body.snoozedUntil !== undefined &&
      current.snoozedUntil?.getTime() === new Date(body.snoozedUntil).getTime()
    );
  }
  if (body.status === 'DISMISSED') return body.reason === undefined;
  return body.status === 'DONE';
}

function countsAsReopen(previous: string, target: ActionUpdateStatus): boolean {
  return target === 'OPEN' && previous !== 'OPEN' && previous !== 'SNOOZED';
}

function sideEffects(
  target: ActionUpdateStatus,
  snoozedUntil: Date | null,
  now: Date,
): Prisma.ActionItemUpdateInput {
  switch (target) {
    case 'DONE':
      return {
        closedAt: now,
        verifiedAt: null,
        resolvedAt: null,
        snoozedUntil: null,
      };
    case 'DISMISSED':
      return { closedAt: now, verifiedAt: null, snoozedUntil: null };
    case 'SNOOZED':
      return {
        snoozedUntil,
        closedAt: null,
        verifiedAt: null,
        resolvedAt: null,
      };
    case 'OPEN':
      return {
        closedAt: null,
        verifiedAt: null,
        resolvedAt: null,
        snoozedUntil: null,
      };
  }
}

function restoredState(
  target: ActionUpdateStatus,
  [before, closing]: readonly RevertEvent[],
): Prisma.ActionItemUpdateInput {
  const cleared = {
    closedAt: null,
    verifiedAt: null,
    resolvedAt: null,
    snoozedUntil: null,
  };
  if (target === 'SNOOZED') {
    return { ...cleared, snoozedUntil: before?.snoozedUntil ?? null };
  }
  if (target === 'OPEN' || before === undefined) return cleared;
  if (before.type === 'verified') {
    return {
      ...cleared,
      closedAt: closing?.occurredAt ?? before.occurredAt,
      verifiedAt: before.occurredAt,
    };
  }
  return { ...cleared, closedAt: before.occurredAt };
}

function transitionEvent(
  previous: string,
  target: ActionUpdateStatus,
): ActionEventType | null {
  switch (target) {
    case 'DONE':
      return 'done';
    case 'DISMISSED':
      return 'dismissed';
    case 'SNOOZED':
      return 'snoozed';
    case 'OPEN':
      if (previous === 'OPEN') return null;
      return previous === 'SNOOZED' ? 'woke' : 'reopened';
  }
}
