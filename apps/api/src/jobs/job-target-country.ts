import { Injectable } from '@nestjs/common';
import { Store } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  CheckCategoryPayload,
  JOBS,
  QUEUES,
  RefreshAppPayload,
  ScoreKeywordPayload,
  SpiderProbePayload,
} from './jobs.types';

export function jobStore(job: Job): Store {
  return job.queueName === QUEUES.GPLAY ? Store.GOOGLE_PLAY : Store.APP_STORE;
}

@Injectable()
export class JobTargetCountry {
  constructor(private readonly prisma: PrismaService) {}

  async of(job: Job): Promise<string | undefined> {
    switch (job.name) {
      case JOBS.CHECK_CATEGORY:
        return (job.data as CheckCategoryPayload).country;
      case JOBS.SPIDER_PROBE:
        return (
          (job.data as SpiderProbePayload).country ??
          this.appCountry((job.data as SpiderProbePayload).appId)
        );
      case JOBS.REFRESH_APP:
      case JOBS.SYNC_REVIEWS:
        return this.appCountry((job.data as RefreshAppPayload).appId);
      case JOBS.CHECK_KEYWORD:
      case JOBS.SCORE_KEYWORD:
        return this.keywordCountry((job.data as ScoreKeywordPayload).keywordId);
      default:
        return undefined;
    }
  }

  private async appCountry(appId: string): Promise<string | undefined> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { country: true },
    });
    return app?.country;
  }

  private async keywordCountry(keywordId: string): Promise<string | undefined> {
    const keyword = await this.prisma.keyword.findUnique({
      where: { id: keywordId },
      select: { country: true },
    });
    return keyword?.country;
  }
}
