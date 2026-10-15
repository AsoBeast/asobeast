import { Module } from '@nestjs/common';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { ChartCaptureService } from './chart-capture.service';
import { ChartFollowsService } from './chart-follows.service';
import { ChartReadService } from './chart-read.service';
import { ChartsController } from './charts.controller';

@Module({
  imports: [StoreProvidersModule],
  controllers: [ChartsController],
  providers: [ChartCaptureService, ChartFollowsService, ChartReadService],
  exports: [ChartCaptureService],
})
export class ChartsModule {}
