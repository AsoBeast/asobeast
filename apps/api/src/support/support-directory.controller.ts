import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import {
  ALL_WORKSPACES,
  type AdminAppList,
  type AdminOverview,
  type AdminUserList,
} from '@asobeast/shared';
import { SUPPORT_NOT_FOUND } from '../auth/admin-access';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requirePlatformOperator } from '../auth/platform-operator';
import { AdminDirectoryQueryDto } from './dto/admin-directory-query.dto';
import { SupportAudit } from './support-audit.service';
import { SupportDirectoryService } from './support-directory.service';
import { SupportOverviewService } from './support-overview.service';

@ApiTags('admin')
@Controller('admin/support')
export class SupportDirectoryController {
  constructor(
    private readonly overview: SupportOverviewService,
    private readonly directory: SupportDirectoryService,
    private readonly audit: SupportAudit,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Instance totals for the platform operator' })
  totals(@CurrentUser() user: User): Promise<AdminOverview> {
    requirePlatformOperator(user, SUPPORT_NOT_FOUND);
    return this.overview.overview();
  }

  @Get('users')
  @ApiOperation({ summary: 'Every account on the instance, newest first' })
  users(
    @CurrentUser() user: User,
    @Query() query: AdminDirectoryQueryDto,
  ): Promise<AdminUserList> {
    return this.listed(user, query, 'users', (workspaceId) =>
      this.directory.users(workspaceId),
    );
  }

  @Get('apps')
  @ApiOperation({ summary: 'Every tracked app on the instance, newest first' })
  apps(
    @CurrentUser() user: User,
    @Query() query: AdminDirectoryQueryDto,
  ): Promise<AdminAppList> {
    return this.listed(user, query, 'apps', (workspaceId) =>
      this.directory.apps(workspaceId),
    );
  }

  private listed<T extends { items: unknown[] }>(
    user: User,
    query: AdminDirectoryQueryDto,
    noun: string,
    list: (workspaceId?: string) => Promise<T>,
  ): Promise<T> {
    requirePlatformOperator(user, SUPPORT_NOT_FOUND);
    return this.audit.attempt({
      actor: user,
      workspaceId: query.workspaceId ?? ALL_WORKSPACES,
      action: 'list',
      reason: null,
      work: () => list(query.workspaceId),
      describe: (result) => `listed ${result.items.length} ${noun}`,
    });
  }
}
