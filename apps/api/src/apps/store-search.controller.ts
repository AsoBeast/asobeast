import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StoreSearchResult } from '@asobeast/shared';
import { SpendsStoreCapacity } from '../auth/decorators/spends-store-capacity.decorator';
import { OnDemandLimiter } from '../auth/on-demand.limiter';
import { StoreDeadlineInterceptor } from '../store-providers/store-deadline.interceptor';
import { StoreSearchQueryDto } from './dto/store-search-query.dto';
import { StoreSearchService } from './store-search.service';

@ApiTags('apps')
@Controller('store')
export class StoreSearchController {
  constructor(
    private readonly storeSearch: StoreSearchService,
    private readonly limiter: OnDemandLimiter,
  ) {}

  @Get('search')
  @SpendsStoreCapacity()
  @UseInterceptors(StoreDeadlineInterceptor)
  @ApiOperation({
    summary: 'Search a store by app name',
    description:
      'Lists up to 25 listings the store returns for a name in one storefront, with the store app id, title, developer, rating and icon, so an app or a competitor can be picked by name before it is imported or added by its id. Reaches the store while you wait, so it answers within the store deadline and spends one store lookup of the hourly allowance; a request the validation refuses spends nothing.',
  })
  search(@Query() query: StoreSearchQueryDto): Promise<StoreSearchResult[]> {
    return this.storeSearch.search(query, () =>
      this.limiter.consume('storeLookup'),
    );
  }
}
