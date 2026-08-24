import { Global, Module } from '@nestjs/common';
import { ErrorTracking } from './error-tracking.service';

@Global()
@Module({
  providers: [ErrorTracking],
  exports: [ErrorTracking],
})
export class ObservabilityModule {}
