import { Injectable } from '@nestjs/common';
import {
  CategoryBucket,
  CategoryRanksService,
} from '../category-ranks/category-ranks.service';
import { ChartFollowsService } from '../charts/chart-follows.service';
import { dedupeBuckets } from './daily-targets.service';

@Injectable()
export class DailyCategoryBuckets {
  constructor(
    private readonly categoryRanks: CategoryRanksService,
    private readonly chartFollows: ChartFollowsService,
  ) {}

  async of(appIds: string[]): Promise<CategoryBucket[]> {
    const [charted, followed] = await Promise.all([
      this.categoryRanks.buckets(appIds),
      this.chartFollows.buckets(),
    ]);
    return dedupeBuckets([...charted, ...followed]);
  }
}
