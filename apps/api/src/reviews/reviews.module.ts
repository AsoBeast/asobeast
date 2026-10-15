import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { ReviewRepliesController } from './review-replies.controller';
import { ReviewRepliesService } from './review-replies.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [StoreProvidersModule, AlertsModule],
  controllers: [ReviewsController, ReviewRepliesController],
  providers: [ReviewsService, ReviewRepliesService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
