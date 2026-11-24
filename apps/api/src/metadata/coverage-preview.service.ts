import { BadRequestException, Injectable } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  assertStorefront,
  countChars,
  CoveragePreviewRequest,
  CoveragePreviewResult,
  KEYWORD_FIELD_INPUT_LIMIT,
  STORE_FIELD_LIMITS,
  tokenize,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { loadAppMarkets } from '../keywords/app-markets';
import { KeywordsService } from '../keywords/keywords.service';
import { ensurePrimaryApp, KeywordApp } from '../keywords/keywords.support';
import { homeLocalization } from '../keywords/localization-markets';
import { PrismaService } from '../prisma/prisma.service';
import { competitorNames } from './competitor-names';
import { loadCoverageSources } from './coverage-sources';
import {
  changeCounts,
  draftedListing,
  draftOverEmptyListing,
  draftMarkets,
  DraftTarget,
  previewKeywords,
  withDraft,
} from './draft-coverage';
import { draftWastedWords } from './draft-wasted-words';
import { CoverageSources } from './keyword-coverage-judge';
import { lintContextOf, listingFieldAudits } from './listing-field-audits';
import { keywordFieldOf, listingSurfaces } from './listing-surfaces';

export const COMPETITOR_DRAFT_REFUSAL =
  'A competitor app has no draft; draft its primary app instead';

const TEXT_LIMITS = {
  title: KEYWORD_FIELD_INPUT_LIMIT,
  subtitle: KEYWORD_FIELD_INPUT_LIMIT,
  shortDescription: KEYWORD_FIELD_INPUT_LIMIT,
  keywordField: KEYWORD_FIELD_INPUT_LIMIT,
  description: STORE_FIELD_LIMITS.GOOGLE_PLAY.description!.limit,
} as const;

function refuseOverlongText(request: CoveragePreviewRequest): void {
  for (const [field, limit] of Object.entries(TEXT_LIMITS)) {
    const text = request[field as keyof typeof TEXT_LIMITS];
    if (text !== undefined && countChars(text) > limit) {
      throw new BadRequestException(
        `${field} must be at most ${limit} characters`,
      );
    }
  }
}

function appStoreTarget(
  app: { country: string },
  request: CoveragePreviewRequest,
): DraftTarget {
  if (request.shortDescription !== undefined) {
    throw new BadRequestException(
      'The App Store has no short description; draft the subtitle instead',
    );
  }
  if (request.country !== undefined) {
    throw new BadRequestException(
      'An App Store draft names a localization, never a country',
    );
  }
  return {
    store: Store.APP_STORE,
    localization: request.localization ?? homeLocalization(app.country),
  };
}

function playTarget(
  app: { country: string },
  request: CoveragePreviewRequest,
  markets: readonly string[],
): DraftTarget {
  if (request.subtitle !== undefined || request.keywordField !== undefined) {
    throw new BadRequestException(
      'Google Play has no subtitle or keyword field; draft the short description instead',
    );
  }
  if (request.localization !== undefined) {
    throw new BadRequestException(
      'Google Play has no localizations; name the market with country instead',
    );
  }
  const country = request.country ?? app.country;
  assertStorefront(Store.GOOGLE_PLAY, country);
  if (!markets.includes(country)) {
    throw new BadRequestException(
      `${country.toUpperCase()} is not a market of this app`,
    );
  }
  return { store: Store.GOOGLE_PLAY, country };
}

interface DraftInputs {
  app: KeywordApp;
  appName: string | null;
  target: DraftTarget;
  markets: string[];
  tracked: TrackedKeywordItem[];
  competitors: string[];
  sources: CoverageSources;
}

@Injectable()
export class CoveragePreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keywords: KeywordsService,
  ) {}

  async preview(
    appId: string,
    request: CoveragePreviewRequest,
  ): Promise<CoveragePreviewResult> {
    const { app, appName, target, markets, tracked, competitors, sources } =
      await this.load(appId, request);
    const { judged, waiting } = draftMarkets(app, markets, sources, target);
    const drafted = withDraft(sources, app, target, request);
    const active = tracked.filter(
      (item) => item.active && judged.includes(item.country),
    );
    const listing =
      draftedListing(app, drafted, target, judged[0]) ??
      draftOverEmptyListing(request);
    const texts = {
      ...listing,
      keywordField:
        target.store === Store.APP_STORE
          ? (request.keywordField ??
            keywordFieldOf(sources.keywordFields, target.localization))
          : '',
    };
    const trackedTexts = active.map((item) => item.text);
    const keywords = previewKeywords(app, active, sources, drafted);
    return {
      appId,
      store: app.store,
      ...(target.store === Store.APP_STORE
        ? { localization: target.localization }
        : { country: target.country }),
      markets: judged,
      waitingMarkets: waiting,
      fields: listingFieldAudits(
        app.store,
        texts,
        lintContextOf(texts, {
          appName,
          competitorNames: competitors,
          trackedKeywords: trackedTexts,
        }),
      ),
      keywords,
      wastedWords: draftWastedWords(
        app.store,
        listingSurfaces(app.store, listing, texts.keywordField),
        trackedTexts,
        tokenize(appName ?? ''),
      ),
      counts: changeCounts(keywords),
    };
  }

  private async load(
    appId: string,
    request: CoveragePreviewRequest,
  ): Promise<DraftInputs> {
    const app = await ensurePrimaryApp(
      this.prisma,
      appId,
      COMPETITOR_DRAFT_REFUSAL,
    );
    refuseOverlongText(request);
    const markets = await loadAppMarkets(this.prisma, app);
    const target =
      app.store === Store.GOOGLE_PLAY
        ? playTarget(app, request, markets)
        : appStoreTarget(app, request);
    const [tracked, competitors, named, { sources }] = await Promise.all([
      this.keywords.listTracked(appId, undefined, undefined, {
        brandFacts: app.store === Store.APP_STORE,
      }),
      competitorNames(this.prisma, appId),
      this.prisma.app.findFirst({
        where: { id: appId },
        select: { name: true },
      }),
      loadCoverageSources(this.prisma, app, markets, {
        market: app.country,
        localization: null,
      }),
    ]);
    return {
      app,
      appName: named?.name ?? null,
      target,
      markets,
      tracked,
      competitors,
      sources,
    };
  }
}
