import { IntersectionType } from '@nestjs/swagger';
import { KeywordMarketQueryDto } from './keyword-market-query.dto';
import { VisibilityHistoryQueryDto } from './visibility-history-query.dto';

export class MarketHistoryQueryDto extends IntersectionType(
  VisibilityHistoryQueryDto,
  KeywordMarketQueryDto,
) {}
