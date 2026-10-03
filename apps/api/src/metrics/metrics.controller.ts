import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SkipRateLimit } from '../auth/rate-limit/rate-class';
import { requirePlatformOperator } from '../auth/platform-operator';
import { METRICS_ROUTE } from '../auth/admin-access';
import { MetricsService } from './metrics.service';
import { METRICS_CONTENT_TYPE } from './prometheus';

@ApiExcludeController()
@Controller(METRICS_ROUTE.slice(1))
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @SkipRateLimit()
  @Header('Content-Type', METRICS_CONTENT_TYPE)
  @Header('Cache-Control', 'no-store')
  scrape(@CurrentUser() user: User): Promise<string> {
    requirePlatformOperator(user, `Cannot GET ${METRICS_ROUTE}`);
    return this.metrics.scrape();
  }
}
