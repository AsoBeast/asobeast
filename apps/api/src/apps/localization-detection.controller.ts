import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LocalizationDetectionResult } from '@asobeast/shared';
import { SpendsStoreCapacity } from '../auth/decorators/spends-store-capacity.decorator';
import { OnDemandLimiter } from '../auth/on-demand.limiter';
import { LocalizationDetection } from './localization-detection.service';
import { QueuesWork } from '../redis/queues-work.decorator';

@ApiTags('apps')
@Controller('apps/:id')
export class LocalizationDetectionController {
  constructor(
    private readonly detection: LocalizationDetection,
    private readonly limiter: OnDemandLimiter,
  ) {}

  @Post('localizations/detect')
  @QueuesWork()
  @SpendsStoreCapacity()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Queue lookups that detect the localizations an app ships',
    description:
      'Takes the localizations the markets of the app read, drops the ones the app ships and, when the home listing declares its languages, the ones in languages it does not declare, then queues one deferred store lookup per remaining localization in the first market that has a stored default listing and can probe it. A lookup records the localization as detected when the store serves a listing that differs from the default one. Spends one refresh allowance only when at least one lookup is newly queued; a localization already queued today queues nothing and spends nothing. Answers 202 with the number of lookups queued and every candidate. Answers 400 for a Google Play app, 404 for an unknown app and 429 when the refresh allowance is spent.',
  })
  detect(@Param('id') id: string): Promise<LocalizationDetectionResult> {
    return this.detection.request(id, () => this.limiter.consume('refresh'));
  }
}
