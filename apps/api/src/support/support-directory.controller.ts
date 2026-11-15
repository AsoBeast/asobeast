import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import {
  ADMIN_CONVERSION_WINDOWS,
  ALL_WORKSPACES,
  type AdminAppList,
  type AdminConversion,
  type AdminDepartureList,
  type AdminOverview,
  type AdminUserList,
} from '@asobeast/shared';
import { SUPPORT_NOT_FOUND } from '../auth/admin-access';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requirePlatformOperator } from '../auth/platform-operator';
import { AdminConversionQueryDto } from './dto/admin-conversion-query.dto';
import { AdminDirectoryQueryDto } from './dto/admin-directory-query.dto';
import { SupportAudit } from './support-audit.service';
import { SupportConversionService } from './support-conversion.service';
import { SupportDirectoryService } from './support-directory.service';
import { SupportOverviewService } from './support-overview.service';

@ApiTags('admin')
@Controller('admin/support')
export class SupportDirectoryController {
  constructor(
    private readonly overview: SupportOverviewService,
    private readonly directory: SupportDirectoryService,
    private readonly audit: SupportAudit,
    private readonly conversions: SupportConversionService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Instance totals for the platform operator' })
  totals(@CurrentUser() user: User): Promise<AdminOverview> {
    requirePlatformOperator(user, SUPPORT_NOT_FOUND);
    return this.overview.overview();
  }

  @Get('conversion')
  @ApiOperation({
    summary: 'Sign up to paid conversion and departures for the operator',
  })
  conversion(
    @CurrentUser() user: User,
    @Query() query: AdminConversionQueryDto,
  ): Promise<AdminConversion> {
    requirePlatformOperator(user, SUPPORT_NOT_FOUND);
    return this.conversions.conversion(
      query.days ?? ADMIN_CONVERSION_WINDOWS[0],
    );
  }

  @Get('departures')
  @ApiOperation({
    summary: 'Erased workspaces, newest first, without any personal data',
  })
  departures(@CurrentUser() user: User): Promise<AdminDepartureList> {
    requirePlatformOperator(user, SUPPORT_NOT_FOUND);
    return this.conversions.departures();
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
