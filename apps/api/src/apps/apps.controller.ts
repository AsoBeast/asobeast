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
  AppDetail,
  AppGroupSummary,
  AppListItem,
  MarketAvailabilityResult,
  SnapshotDiffResult,
} from '@asobeast/shared';
import { AppGroupsService } from './app-groups.service';
import { OnDemandLimiter } from '../auth/on-demand.limiter';
import { SpendsStoreCapacity } from '../auth/decorators/spends-store-capacity.decorator';
import { AppsService } from './apps.service';
import { ImportAppDto } from './dto/import-app.dto';
import { LinkAppDto } from './dto/link-app.dto';
import { MarketAvailabilityQueryDto } from './dto/market-availability-query.dto';

@ApiTags('apps')
@Controller('apps')
export class AppsController {
  constructor(
    private readonly apps: AppsService,
    private readonly groups: AppGroupsService,
    private readonly limiter: OnDemandLimiter,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Import an app from a store URL' })
  import(@Body() dto: ImportAppDto): Promise<AppDetail> {
    return this.apps.importFromUrl(dto.url, dto.country);
  }

  @Get()
  @ApiOperation({ summary: 'List imported apps' })
  list(): Promise<AppListItem[]> {
    return this.apps.list();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an app with its latest snapshot and competitors',
  })
  detail(@Param('id') id: string): Promise<AppDetail> {
    return this.apps.detail(id);
  }

  @Get(':id/market-availability')
  @SpendsStoreCapacity()
  @ApiOperation({
    summary: 'Probe whether an app is published in a storefront',
  })
  async marketAvailability(
    @Param('id') id: string,
    @Query() query: MarketAvailabilityQueryDto,
  ): Promise<MarketAvailabilityResult> {
    await this.limiter.consume('refresh');
    return this.apps.marketAvailability(id, query.country);
  }

  @Post(':id/refresh')
  @SpendsStoreCapacity()
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh an app and return the snapshot diff' })
  async refresh(@Param('id') id: string): Promise<SnapshotDiffResult> {
    await this.limiter.consume('refresh');
    return this.apps.refreshApp(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an app' })
  remove(@Param('id') id: string): Promise<void> {
    return this.apps.remove(id);
  }

  @Post(':id/link')
  @ApiOperation({
    summary: 'Link an app to its counterpart on the other store',
  })
  link(
    @Param('id') id: string,
    @Body() dto: LinkAppDto,
  ): Promise<AppGroupSummary> {
    return this.groups.linkApp(id, dto.appId);
  }

  @Delete(':id/link')
  @HttpCode(204)
  @ApiOperation({ summary: 'Unlink an app from its group' })
  unlink(@Param('id') id: string): Promise<void> {
    return this.groups.unlinkApp(id);
  }
}
