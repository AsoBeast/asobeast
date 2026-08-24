import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppGroupSummary } from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { toAppGroupSummary } from './apps.mapper';

@Injectable()
export class AppGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
  ) {}

  async linkApp(id: string, appId: string): Promise<AppGroupSummary> {
    if (id === appId) {
      throw new BadRequestException('An app cannot be linked to itself');
    }

    const [primary, counterpart] = await Promise.all([
      this.findPrimary(id),
      this.findPrimary(appId),
    ]);

    if (primary.store === counterpart.store) {
      throw new BadRequestException('Linked apps must be on different stores');
    }

    if (primary.groupId && counterpart.groupId) {
      throw new BadRequestException(
        'Both apps are already linked; unlink one first',
      );
    }

    const existingGroupId = primary.groupId ?? counterpart.groupId;

    const groupId = await this.prisma.withTransaction(async (tx) => {
      if (existingGroupId) {
        const ungrouped = primary.groupId ? counterpart : primary;
        const conflict = await tx.app.findFirst({
          where: { groupId: existingGroupId, store: ungrouped.store },
          select: { id: true },
        });
        if (conflict) {
          throw new BadRequestException(
            'The group already has an app on that store',
          );
        }
        await tx.app.update({
          where: { id: ungrouped.id },
          data: { groupId: existingGroupId },
        });
        return existingGroupId;
      }

      const group = await tx.appGroup.create({
        data: {
          workspaceId: this.workspace.require('an app group'),
          name: primary.name ?? counterpart.name ?? 'App group',
        },
      });
      await tx.app.updateMany({
        where: { id: { in: [primary.id, counterpart.id] } },
        data: { groupId: group.id },
      });
      return group.id;
    });

    return this.groupSummary(groupId);
  }

  async unlinkApp(id: string): Promise<void> {
    const app = await this.prisma.app.findFirst({
      where: { id },
      select: { id: true, groupId: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }
    if (!app.groupId) {
      throw new NotFoundException(`App ${id} is not linked`);
    }
    await this.detachFromGroup(app.id, app.groupId);
  }

  private async findPrimary(id: string) {
    const app = await this.prisma.app.findFirst({
      where: { id, isCompetitor: false },
      select: { id: true, store: true, name: true, groupId: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }
    return app;
  }

  private async groupSummary(groupId: string): Promise<AppGroupSummary> {
    const group = await this.prisma.appGroup.findUniqueOrThrow({
      where: { id: groupId },
      include: { apps: true },
    });
    return toAppGroupSummary(group);
  }

  private async detachFromGroup(appId: string, groupId: string): Promise<void> {
    await this.prisma.withTransaction(async (tx) => {
      await tx.app.update({ where: { id: appId }, data: { groupId: null } });
      const remaining = await tx.app.count({ where: { groupId } });
      if (remaining < 2) {
        await tx.app.updateMany({
          where: { groupId },
          data: { groupId: null },
        });
        await tx.appGroup.delete({ where: { id: groupId } });
      }
    });
  }
}
