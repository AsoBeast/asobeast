import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import type { AdminOverview } from '@asobeast/shared';
import { SUPPORT_NOT_FOUND } from '../auth/admin-access';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { requirePlatformOperator } from '../auth/platform-operator';
import { SupportOverviewService } from './support-overview.service';

@ApiTags('admin')
@Controller('admin/support')
export class SupportDirectoryController {
  constructor(private readonly overview: SupportOverviewService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Instance totals for the platform operator' })
  totals(@CurrentUser() user: User): Promise<AdminOverview> {
    requirePlatformOperator(user, SUPPORT_NOT_FOUND);
    return this.overview.overview();
  }
}
