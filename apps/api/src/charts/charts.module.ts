import { Module } from '@nestjs/common';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { ChartCaptureService } from './chart-capture.service';

@Module({
  imports: [StoreProvidersModule],
  providers: [ChartCaptureService],
  exports: [ChartCaptureService],
})
export class ChartsModule {}
