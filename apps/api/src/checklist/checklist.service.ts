import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  buildChecklist,
  WORKSPACE_GOALS,
  type WorkspaceChecklist,
  type WorkspaceChecklistUpdateRequest,
  type WorkspaceGoal,
} from '@asobeast/shared';
import type { SecretBox } from '../common/crypto/secret-box';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { SECRET_BOX } from '../store-connect/secret-box.provider';
import { readChecklistFacts } from './checklist-facts';

export function goalOf(value: string | null | undefined): WorkspaceGoal | null {
  return WORKSPACE_GOALS.find((goal) => goal === value) ?? null;
}

export async function describeChecklist(
  tx: Prisma.TransactionClient,
  consoleAvailable: boolean,
): Promise<WorkspaceChecklist> {
  const workspace = await tx.workspace.findFirst({
    select: { checklistGoal: true, checklistDismissedAt: true },
  });
  const facts = await readChecklistFacts(tx, consoleAvailable);
  return buildChecklist(
    facts,
    goalOf(workspace?.checklistGoal),
    workspace?.checklistDismissedAt?.toISOString() ?? null,
  );
}

export function checklistChanges(
  patch: WorkspaceChecklistUpdateRequest,
  currentDismissedAt: Date | null,
  now: Date,
): Prisma.WorkspaceUpdateInput {
  const changes: Prisma.WorkspaceUpdateInput = {};
  if (patch.goal !== undefined) changes.checklistGoal = patch.goal;
  if (patch.dismissed === true && currentDismissedAt === null) {
    changes.checklistDismissedAt = now;
  }
  if (patch.dismissed === false && currentDismissedAt !== null) {
    changes.checklistDismissedAt = null;
  }
  return changes;
}

@Injectable()
export class ChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
    @Inject(SECRET_BOX) private readonly box: SecretBox | null,
  ) {}

  read(): Promise<WorkspaceChecklist> {
    return this.prisma.withTransaction((tx) =>
      describeChecklist(tx, this.box !== null),
    );
  }

  update(patch: WorkspaceChecklistUpdateRequest): Promise<WorkspaceChecklist> {
    return this.prisma.withTransaction(async (tx) => {
      const current = await tx.workspace.findFirst({
        select: { checklistDismissedAt: true },
      });
      const changes = checklistChanges(
        patch,
        current?.checklistDismissedAt ?? null,
        new Date(),
      );
      if (Object.keys(changes).length > 0) {
        await tx.workspace.update({
          where: { id: this.workspace.require('a workspace checklist') },
          data: changes,
        });
      }
      return describeChecklist(tx, this.box !== null);
    });
  }
}
