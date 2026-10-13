import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MarketSeedResult } from '@asobeast/shared';
import { SpendsStoreCapacity } from '../auth/decorators/spends-store-capacity.decorator';
import { OnDemandLimiter } from '../auth/on-demand.limiter';
import { StoreDeadlineInterceptor } from '../store-providers/store-deadline.interceptor';
import { MarketSeedDto } from './dto/market-seed.dto';
import { MarketSeedService } from './market-seed.service';

@ApiTags('keywords')
@Controller('apps/:id')
export class MarketSeedController {
  constructor(
    private readonly seeds: MarketSeedService,
    private readonly limiter: OnDemandLimiter,
  ) {}

  @Post('market-seed')
  @HttpCode(200)
  @SpendsStoreCapacity()
  @UseInterceptors(StoreDeadlineInterceptor)
  @ApiOperation({
    summary: 'Seed a market with the keywords of its own listing',
    description:
      'Captures the listing of the app in one storefront now, extracts the title and subtitle phrases of that listing and of its native localizations, tracks up to 15 of them in that market as listing keywords within the keyword room of the plan, queues their first score and first position check, and asks for the listings of the competitors there. A phrase the app already tracks there, active or paused, is left as it is. Phrases the room cannot hold are counted in skipped, never refused. Answers status unavailable and writes nothing when the store has no listing of the app in that storefront. Spends one refresh allowance once the store is asked, so a refusal costs nothing. Answers 400 for the home market, for a competitor app and for a code that is not a storefront of the app store, 404 for an unknown app and 429 when the refresh allowance is spent.',
  })
  seed(
    @Param('id') id: string,
    @Body() dto: MarketSeedDto,
  ): Promise<MarketSeedResult> {
    return this.seeds.seed(id, dto.country, () =>
      this.limiter.consume('refresh'),
    );
  }
}
