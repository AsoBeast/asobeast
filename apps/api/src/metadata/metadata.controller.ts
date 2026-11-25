import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoveragePreviewResult, MetadataAuditResult } from '@asobeast/shared';
import { ListingQueryDto } from '../apps/dto/listing-query.dto';
import { RateLimitClass } from '../auth/rate-limit/rate-class';
import { ReadOnlyEndpoint } from '../auth/read-access';
import { CoveragePreviewService } from './coverage-preview.service';
import { CoveragePreviewDto } from './dto/coverage-preview.dto';
import { MetadataService } from './metadata.service';

@ApiTags('metadata')
@Controller('apps/:id/metadata')
export class MetadataController {
  constructor(
    private readonly metadata: MetadataService,
    private readonly coverage: CoveragePreviewService,
  ) {}

  @Get('audit')
  @ApiOperation({ summary: 'Metadata lint and keyword coverage matrix' })
  audit(
    @Param('id') id: string,
    @Query() query: ListingQueryDto,
  ): Promise<MetadataAuditResult> {
    return this.metadata.audit(id, query.country, query.localization ?? null);
  }

  @Post('coverage-preview')
  @HttpCode(200)
  @ReadOnlyEndpoint()
  @RateLimitClass('read')
  @ApiOperation({
    summary: 'Preview the keywords a draft listing would cover',
    description:
      'Takes a draft of one listing: an App Store localization (title, subtitle, keyword field, description) or a Google Play market (title, short description, description). A field left out keeps its live value. Answers, for every active tracked keyword of the markets that read that listing, the live and the drafted coverage verdict judged as the coverage table judges them, the change between them, the lint of the drafted fields and the words the draft wastes. Markets that read the localization but are still judged on the home listing are named in waitingMarkets. Writes nothing, queues nothing and calls no store. Answers 400 for a competitor app, for a field the store does not have and for a localization on Google Play, and 404 for a missing app.',
  })
  coveragePreview(
    @Param('id') id: string,
    @Body() dto: CoveragePreviewDto,
  ): Promise<CoveragePreviewResult> {
    return this.coverage.preview(id, dto);
  }
}
