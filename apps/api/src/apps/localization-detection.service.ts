import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Store } from '@prisma/client';
import { JobsOptions, Queue } from 'bullmq';
import { LocalizationDetectionResult } from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { enqueueReplacingFailed } from '../jobs/enqueue-replacing-failed';
import { DEFERRED_JOB_OPTIONS } from '../jobs/job-options';
import {
  DetectLocalizationPayload,
  detectLocalizationJobId,
  JOBS,
  QUEUES,
  utcDateKey,
} from '../jobs/jobs.types';
import { recordAppLocalizations } from '../keywords/app-localization-records';
import { AppLocalizationsService } from '../keywords/app-localizations.service';
import { ensureKeywordFieldApp } from '../keywords/keywords.support';
import { PrismaService } from '../prisma/prisma.service';
import { extractRawFacts } from '../store-providers/raw-facts';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { HOME_LISTING, listingIn, NEWEST_FIRST } from './listing';
import { latestListingTexts } from './listing-texts';
import { detectionCandidates } from './localization-candidates';
import { servesLocalization } from './localization-served';

const DETECTION_DEDUPE_SECONDS = 24 * 60 * 60;

const DETECTION_JOB_OPTIONS = {
  ...DEFERRED_JOB_OPTIONS,
  removeOnComplete: { age: DETECTION_DEDUPE_SECONDS },
} satisfies JobsOptions;

@Injectable()
export class LocalizationDetection {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
    private readonly shipped: AppLocalizationsService,
    private readonly workspace: WorkspaceContext,
    @InjectQueue(QUEUES.APP_STORE) private readonly queue: Queue,
  ) {}

  async request(
    appId: string,
    spend: () => Promise<void>,
  ): Promise<LocalizationDetectionResult> {
    const app = await ensureKeywordFieldApp(this.prisma, appId);
    const { home, markets, localizations } = await this.shipped.list(appId);
    const [listings, latest] = await Promise.all([
      latestListingTexts(this.prisma, appId, home, markets),
      this.prisma.appSnapshot.findFirst({
        where: { appId, ...HOME_LISTING },
        orderBy: NEWEST_FIRST,
        select: { raw: true },
      }),
    ]);
    const languages = extractRawFacts(app.store, latest?.raw).languages;
    const candidates = detectionCandidates({
      home,
      markets,
      listedMarkets: new Set(listings.keys()),
      shipped: new Set(localizations.map((item) => item.localization)),
      languages: languages.length > 0 ? languages : null,
    });
    const date = utcDateKey();
    const idOf = (localization: string) =>
      detectLocalizationJobId(appId, localization, date);
    const open = await Promise.all(
      candidates.map(({ localization }) => this.isOpen(idOf(localization))),
    );
    const fresh = candidates.filter((_, index) => open[index]);
    const answer = (queued: number): LocalizationDetectionResult => ({
      queued,
      candidates: candidates.map(({ localization }) => localization),
    });
    if (fresh.length === 0) return answer(0);

    await spend();
    const scope = this.workspace.scopeFor('a localization detection');
    const added = await Promise.all(
      fresh.map(({ localization, country }) =>
        enqueueReplacingFailed(
          this.queue,
          JOBS.DETECT_LOCALIZATION,
          {
            appId,
            localization,
            country,
            ...scope,
          } satisfies DetectLocalizationPayload,
          { ...DETECTION_JOB_OPTIONS, jobId: idOf(localization) },
        ),
      ),
    );
    return answer(added.filter(Boolean).length);
  }

  async probe({
    appId,
    localization,
    country,
  }: DetectLocalizationPayload): Promise<void> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: {
        workspaceId: true,
        store: true,
        storeAppId: true,
        country: true,
      },
    });
    if (!app || app.store !== Store.APP_STORE) return;
    const stored = await this.prisma.appSnapshot.findFirst({
      where: { appId, ...listingIn(app.country, country) },
      orderBy: NEWEST_FIRST,
    });
    if (!stored) return;
    const served = await this.registry
      .get(app.store)
      .getApp(app.storeAppId, country, localization);
    if (!servesLocalization(app.store, stored, served)) return;
    await recordAppLocalizations(this.prisma, [
      {
        appId,
        workspaceId: app.workspaceId,
        localization,
        origin: 'detected',
      },
    ]);
  }

  private async isOpen(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    return job === undefined || (await job.isFailed());
  }
}
