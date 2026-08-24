import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProxyPoolHealth } from '@asobeast/shared';
import type { User } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { isPlatformOperator } from '../../auth/platform-operator';
import { ProxyPoolHealthReport } from './proxy-pool-health.service';

@ApiTags('admin')
@Controller('admin/proxy-pool')
export class ProxyPoolController {
  constructor(private readonly report: ProxyPoolHealthReport) {}

  @Get()
  @ApiOperation({ summary: 'Egress proxy pool health for operators' })
  health(@CurrentUser() user: User): Promise<ProxyPoolHealth> {
    if (!isPlatformOperator(user)) {
      throw new NotFoundException('Cannot GET /admin/proxy-pool');
    }
    return this.report.build();
  }
}
