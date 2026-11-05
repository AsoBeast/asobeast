import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  buildChecklist,
  WORKSPACE_GOALS,
  type WorkspaceChecklist,
  type WorkspaceGoal,
} from '@asobeast/shared';
import type { SecretBox } from '../common/crypto/secret-box';
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

@Injectable()
export class ChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SECRET_BOX) private readonly box: SecretBox | null,
  ) {}

  read(): Promise<WorkspaceChecklist> {
    return this.prisma.withTransaction((tx) =>
      describeChecklist(tx, this.box !== null),
    );
  }
}
