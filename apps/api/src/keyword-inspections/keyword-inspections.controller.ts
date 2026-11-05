import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { KeywordInspection, KeywordInspectionList } from '@asobeast/shared';
import { SpendsStoreCapacity } from '../auth/decorators/spends-store-capacity.decorator';
import { OnDemandLimiter } from '../auth/on-demand.limiter';
import { QueuesWork } from '../redis/queues-work.decorator';
import { ListKeywordInspectionsQueryDto } from './dto/list-keyword-inspections-query.dto';
import { RequestKeywordInspectionDto } from './dto/request-keyword-inspection.dto';
import { KeywordInspectionsService } from './keyword-inspections.service';

@ApiTags('keyword-inspections')
@Controller('keyword-inspections')
export class KeywordInspectionsController {
  constructor(
    private readonly inspections: KeywordInspectionsService,
    private readonly limiter: OnDemandLimiter,
  ) {}

  @Post()
  @QueuesWork()
  @SpendsStoreCapacity()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Inspect any keyword in one storefront',
    description:
      'Queues a live inspection of a keyword the workspace does not need to track: the top 50 search results, the store autocomplete, popularity, difficulty and opportunity with their source and confidence, and a competition summary of the top 10. Answers at once with the pending inspection; poll GET /keyword-inspections/{id} until status is DONE or FAILED. An inspection of the same keyword and storefront that is still pending is answered instead of queuing another. A queued inspection spends one on demand score of the hourly allowance; a request the validation refuses spends nothing.',
  })
  request(
    @Body() dto: RequestKeywordInspectionDto,
  ): Promise<KeywordInspection> {
    return this.inspections.request(dto, () => this.limiter.consume('score'));
  }

  @Get()
  @ApiOperation({
    summary: 'List keyword inspections',
    description:
      'Lists the inspections of the workspace, newest first, optionally filtered to one keyword, store or storefront. Reads stored rows only.',
  })
  list(
    @Query() query: ListKeywordInspectionsQueryDto,
  ): Promise<KeywordInspectionList> {
    return this.inspections.list(query);
  }

  @Get(':inspectionId')
  @ApiOperation({
    summary: 'Read one keyword inspection',
    description:
      'Answers the inspection with its search results, suggestions, scores and competition summary, and the change since the previous completed inspection of the same keyword and storefront. Reads stored rows only.',
  })
  get(@Param('inspectionId') id: string): Promise<KeywordInspection> {
    return this.inspections.get(id);
  }

  @Delete(':inspectionId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a keyword inspection' })
  remove(@Param('inspectionId') id: string): Promise<void> {
    return this.inspections.remove(id);
  }
}
