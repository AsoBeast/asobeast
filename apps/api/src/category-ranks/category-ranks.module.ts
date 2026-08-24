import { Module } from '@nestjs/common';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { CategoryRanksController } from './category-ranks.controller';
import { CategoryRanksService } from './category-ranks.service';

@Module({
  imports: [StoreProvidersModule],
  controllers: [CategoryRanksController],
  providers: [CategoryRanksService],
  exports: [CategoryRanksService],
})
export class CategoryRanksModule {}
