import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ActionDismissReason,
  ActionEventActor,
  ActionEventType,
  ActionPriority,
  ActionStatus,
} from '@asobeast/shared';

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
