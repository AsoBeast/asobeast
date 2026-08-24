import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ScoreEnqueueResult } from '@asobeast/shared';
import { SpendsStoreCapacity } from '../auth/decorators/spends-store-capacity.decorator';
import { OnDemandLimiter } from '../auth/on-demand.limiter';
import { PipelineService } from './pipeline.service';

@ApiTags('scoring')
@Controller('keywords')
export class ScoringController {
  constructor(
    private readonly pipeline: PipelineService,
    private readonly limiter: OnDemandLimiter,
  ) {}

  @Post(':keywordId/score')
  @SpendsStoreCapacity()
  @HttpCode(202)
  @ApiOperation({ summary: 'Enqueue an on demand keyword score' })
  async score(
    @Param('keywordId') keywordId: string,
  ): Promise<ScoreEnqueueResult> {
    await this.limiter.consume('score');
    await this.pipeline.enqueueScore(keywordId);
    return { enqueued: true };
  }
}
