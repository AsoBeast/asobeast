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
import { ActionEventRecorder } from './action-events';
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
    validateShape(body);
    if (body.revert) return this.revert(tx, current, body);
    const note = body.note === undefined ? {} : { note: body.note.trim() };
    if (isNoteOnly(current, body)) {
      return tx.actionItem.update({
        where: { id: current.id },
        data: note,
        select: ROW_SELECT,
      });
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
    if (type) {
      await this.recorder.record(tx, [
        {
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
      ]);
    }
    return row;
  }

  private async revert(
    tx: Prisma.TransactionClient,
    current: CurrentAction,
    body: ActionUpdateRequest,
  ): Promise<ActionRow> {
    const now = new Date();
    const [latest, before] = await tx.actionEvent.findMany({
      where: { actionId: current.id },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: 2,
      select: {
        id: true,
        type: true,
        actor: true,
        status: true,
        occurredAt: true,
      },
    });
    const windowStart =
      now.getTime() - ACTION_REVERT_WINDOW_MINUTES * MINUTE_MS;
    if (latest?.actor !== 'user' || latest.occurredAt.getTime() < windowStart) {
      throw new ConflictException('Nothing recent to undo on this action');
    }
    if (body.status !== (before?.status ?? 'OPEN')) {
      throw new ConflictException('Undo must restore the previous status');
    }

    const row = await tx.actionItem.update({
      where: { id: current.id },
      data: {
        status: body.status,
        ...sideEffects(body.status, this.snoozeDate(body, now), now),
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
  return body.status === 'DONE' || body.status === 'DISMISSED';
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
