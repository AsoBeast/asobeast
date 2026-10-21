import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AlertsModule } from '../alerts/alerts.module';
import { StoreConnectModule } from '../store-connect/store-connect.module';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { AscReviewLocator } from './asc-review-locator.service';
import { ReviewRepliesController } from './review-replies.controller';
import { ReviewRepliesService } from './review-replies.service';
import { ReviewReplyAssistant } from './review-reply-assistant.service';
import { ReviewReplyGuidelinesController } from './review-reply-guidelines.controller';
import { ReviewThemesService } from './review-themes.service';
import { ReviewTranslationController } from './review-translation.controller';
import { ReviewTranslator } from './review-translator.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [StoreProvidersModule, StoreConnectModule, AlertsModule, AiModule],
  controllers: [
    ReviewsController,
    ReviewRepliesController,
    ReviewReplyGuidelinesController,
    ReviewTranslationController,
  ],
  providers: [
    AscReviewLocator,
    ReviewsService,
    ReviewRepliesService,
    ReviewReplyAssistant,
    ReviewThemesService,
    ReviewTranslator,
  ],
  exports: [ReviewsService],
})
export class ReviewsModule {}
