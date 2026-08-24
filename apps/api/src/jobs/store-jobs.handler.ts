import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { AppsService } from '../apps/apps.service';
import { CategoryRanksService } from '../category-ranks/category-ranks.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { SpiderService } from '../keywords/spider.service';
import { RankingsService } from '../rankings/rankings.service';
import { ReviewsService } from '../reviews/reviews.service';
import { ScoringService } from '../scoring/scoring.service';
import { ProxyEgress } from '../store-providers/egress/proxy-egress.service';
import { jobStore, JobTargetCountry } from './job-target-country';
import {
  CheckCategoryPayload,
  CheckKeywordPayload,
  JOBS,
  RefreshAppPayload,
  ScoreKeywordPayload,
  SpiderProbePayload,
  SyncReviewsPayload,
} from './jobs.types';
import { requireJobScope } from './job-workspace';

@Injectable()
export class StoreJobsHandler {
  constructor(
    private readonly apps: AppsService,
    private readonly rankings: RankingsService,
    private readonly scoring: ScoringService,
    private readonly categoryRanks: CategoryRanksService,
    private readonly reviews: ReviewsService,
    private readonly spider: SpiderService,
    private readonly workspace: WorkspaceContext,
    private readonly egress: ProxyEgress,
    private readonly targetCountry: JobTargetCountry,
  ) {}

  async handle(job: Job): Promise<void> {
    await this.workspace.runScope(requireJobScope(job), async () => {
      const country = await this.targetCountry.of(job);
      await this.egress.through(jobStore(job), country, () =>
        this.dispatch(job),
      );
    });
  }

  private async dispatch(job: Job): Promise<void> {
    switch (job.name) {
      case JOBS.REFRESH_APP:
        await this.apps.refreshApp((job.data as RefreshAppPayload).appId);
        return;
      case JOBS.CHECK_KEYWORD:
        await this.rankings.checkKeyword(
          (job.data as CheckKeywordPayload).keywordId,
        );
        return;
      case JOBS.CHECK_CATEGORY:
        await this.categoryRanks.checkCategory(
          job.data as CheckCategoryPayload,
        );
        return;
      case JOBS.SCORE_KEYWORD:
        await this.scoring.scoreKeyword(
          (job.data as ScoreKeywordPayload).keywordId,
        );
        return;
      case JOBS.SYNC_REVIEWS:
        await this.reviews.syncReviews(job.data as SyncReviewsPayload);
        return;
      case JOBS.SPIDER_PROBE:
        await this.spider.runSpiderProbe(job.data as SpiderProbePayload);
        return;
      default:
        throw new Error(`Unknown job ${job.name}`);
    }
  }
}
