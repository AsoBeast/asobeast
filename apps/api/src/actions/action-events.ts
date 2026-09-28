import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ACTION_EVENT_ACTORS,
  ActionDismissReason,
  ActionEventActor,
  ActionEventItem,
  ActionEventType,
  ActionPriority,
  ActionStatus,
  isActionDismissReason,
  isActionEventType,
  isActionStatus,
} from '@asobeast/shared';
import { priorityOf } from './actions.mapper';

export interface ActionEventInput {
  workspaceId: string;
  actionId: string;
  appId: string;
  type: ActionEventType;
  actor: ActionEventActor;
  userId: string | null;
  status: ActionStatus;
  priority: ActionPriority;
  impact: number;
  snoozedUntil: Date | null;
  reason: ActionDismissReason | null;
  occurredAt: Date;
}

@Injectable()
export class ActionEventRecorder {
  async record(
    tx: Prisma.TransactionClient,
    events: readonly ActionEventInput[],
  ): Promise<void> {
    if (events.length === 0) return;
    await tx.actionEvent.createMany({ data: [...events] });
  }
}

export const EVENT_SELECT = {
  id: true,
  type: true,
  actor: true,
  status: true,
  priority: true,
  impact: true,
  snoozedUntil: true,
  reason: true,
  occurredAt: true,
  user: { select: { name: true } },
} satisfies Prisma.ActionEventSelect;

export type ActionEventRow = Prisma.ActionEventGetPayload<{
  select: typeof EVENT_SELECT;
}>;

const isEventActor = (value: string): value is ActionEventActor =>
  ACTION_EVENT_ACTORS.some((actor) => actor === value);

export function toActionEventItem(row: ActionEventRow): ActionEventItem | null {
  if (!isActionEventType(row.type) || !isEventActor(row.actor)) return null;
  return {
    id: row.id,
    type: row.type,
    actor: row.actor,
    actorName: row.user?.name ?? null,
    occurredAt: row.occurredAt.toISOString(),
    status: isActionStatus(row.status) ? row.status : 'OPEN',
    priority: priorityOf(row.priority),
    impact: row.impact,
    snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
    reason: isActionDismissReason(row.reason) ? row.reason : null,
  };
}
