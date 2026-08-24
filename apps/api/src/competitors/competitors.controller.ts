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
import {
  CompetitorAnalysis,
  CompetitorDiscovery,
  CompetitorItem,
} from '@asobeast/shared';
import { CompetitorsService } from './competitors.service';
import { AddCompetitorDto } from './dto/add-competitor.dto';
import { DiscoveryQueryDto } from './dto/discovery-query.dto';

@ApiTags('competitors')
@Controller('apps/:id/competitors')
export class CompetitorsController {
  constructor(private readonly competitors: CompetitorsService) {}

  @Get('analysis')
  @ApiOperation({ summary: 'Keyword gap and positioning analysis' })
  analysis(@Param('id') id: string): Promise<CompetitorAnalysis> {
    return this.competitors.analysis(id);
  }

  @Get('discovery')
  @ApiOperation({ summary: 'Untracked apps recurring in your keyword results' })
  discovery(
    @Param('id') id: string,
    @Query() query: DiscoveryQueryDto,
  ): Promise<CompetitorDiscovery> {
    return this.competitors.discovery(id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Add a competitor app from a store URL' })
  add(
    @Param('id') id: string,
    @Body() dto: AddCompetitorDto,
  ): Promise<CompetitorItem> {
    return this.competitors.add(id, dto.url);
  }

  @Get()
  @ApiOperation({ summary: 'List competitors for an app' })
  list(@Param('id') id: string): Promise<CompetitorItem[]> {
    return this.competitors.list(id);
  }

  @Delete(':competitorId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a competitor from an app' })
  remove(
    @Param('id') id: string,
    @Param('competitorId') competitorId: string,
  ): Promise<void> {
    return this.competitors.remove(id, competitorId);
  }
}
