import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoryRankSeries } from '@asobeast/shared';
import { CategoryRankHistoryQueryDto } from './dto/category-rank-history-query.dto';
import { CategoryRanksService } from './category-ranks.service';

@ApiTags('category-ranks')
@Controller('apps')
export class CategoryRanksController {
  constructor(private readonly categoryRanks: CategoryRanksService) {}

  @Get(':id/category-ranks')
  @ApiOperation({ summary: 'Category rank history series for an app' })
  history(
    @Param('id') id: string,
    @Query() query: CategoryRankHistoryQueryDto,
  ): Promise<CategoryRankSeries> {
    return this.categoryRanks.history(id, query);
  }
}
