import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [StoreProvidersModule, AlertsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
