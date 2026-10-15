import { Module } from '@nestjs/common';
import { ChartsModule } from '../charts/charts.module';
import { CategoryRanksController } from './category-ranks.controller';
import { CategoryRanksService } from './category-ranks.service';

@Module({
  imports: [ChartsModule],
  controllers: [CategoryRanksController],
  providers: [CategoryRanksService],
  exports: [CategoryRanksService],
})
export class CategoryRanksModule {}
