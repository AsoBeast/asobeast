import { Injectable, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  assertStorefront,
  fieldLength,
  KEYWORD_FIELD_BYTE_LIMIT,
  packKeywordField,
  CoverageFieldStatus,
  KeywordCoverageRow,
  KeywordFieldSuggestion,
  lintDescription,
  lintKeywordField,
  lintShortDescription,
  lintSubtitle,
  lintTitle,
  LintContext,
  MetadataAuditResult,
  MetadataField,
  MetadataFieldAudit,
  STORE_FIELD_LIMITS,
  tokenize,
  TrackedKeywordItem,
  utf8ByteLength,
} from '@asobeast/shared';
import { coversKeyword } from '../keywords/keyword-coverage';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { latestListingTexts, ListingTexts } from '../apps/listing-texts';
import { ScreenshotsService } from '../screenshots/screenshots.service';
import {
  screenshotTextCoverage,
  screenshotTextState,
} from './screenshot-coverage';

const singularize = (text: string): string =>
  tokenize(text)
    .map((word) =>
      word.length > 3 && word.endsWith('s') && !word.endsWith('ss')
        ? word.slice(0, -1)
        : word,
    )
    .join(' ');

@Injectable()
export class MetadataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keywords: KeywordsService,
    private readonly screenshots: ScreenshotsService,
  ) {}

  async audit(appId: string, country?: string): Promise<MetadataAuditResult> {
    const app = await this.ensureApp(appId);
    const market = country ?? app.country;
    const home = market === app.country;
    if (!home) {
      assertStorefront(app.store, market);
    }
    const [tracked, competitors] = await Promise.all([
      this.keywords.listTracked(appId, undefined, country),
      this.prisma.app.findMany({
        where: { primaryAppId: appId },
        select: { name: true },
      }),
    ]);
    const active = tracked.filter((item) => item.active);
    const listings = await latestListingTexts(this.prisma, appId, app.country, [
      app.country,
      market,
      ...active.map((item) => item.country),
    ]);
    const view = listings.get(market);
    if (!home && !view) {
      throw new NotFoundException(`No listing captured for ${market}`);
    }

    const keywordFieldValue = home
      ? active
          .filter((item) => item.source === 'KEYWORD_FIELD')
          .map((item) => item.text)
          .join(',')
      : '';
    const context: LintContext = {
      titleWords: tokenize(view?.title ?? ''),
      subtitleWords: tokenize(view?.subtitle ?? ''),
      brandTokens: tokenize(app.name ?? ''),
      competitorNames: competitors
        .map((competitor) => competitor.name)
        .filter((name): name is string => Boolean(name)),
      trackedKeywords: active.map((item) => item.text),
    };
    const fields =
      app.store === Store.GOOGLE_PLAY
        ? this.playFields(view, context)
        : this.appStoreFields(view, context, keywordFieldValue);

    const coverage = active.map((item) => {
      const own = listings.get(item.country);
      return this.coverageRow(
        item,
        this.surfaces(
          app.store,
          own ?? listings.get(app.country),
          own && item.country !== app.country ? null : keywordFieldValue,
        ),
        own ? item.country : app.country,
      );
    });
    const shots = await this.screenshots.forApp(appId);
    const screenshotText = screenshotTextState(
      shots.screenshots,
      shots.reading,
    );

    return {
      appId,
      store: app.store,
      fields,
      coverage:
        screenshotText?.status === 'ready'
          ? coverage.map((row) => ({
              ...row,
              screenshotText: screenshotTextCoverage(
                shots.screenshots,
                row.text,
              ),
            }))
          : coverage,
      keywordFieldSuggestion:
        home && app.store === Store.APP_STORE
          ? this.suggestion(
              active.filter((item) => item.country === app.country),
              coverage.filter((row) => row.country === app.country),
            )
          : null,
      screenshotText,
      country: market,
    };
  }

  private playFields(
    view: ListingTexts | undefined,
    context: LintContext,
  ): MetadataFieldAudit[] {
    const store = Store.GOOGLE_PLAY;
    const title = view?.title ?? '';
    const summary = view?.summary ?? '';
    const description = view?.description ?? '';
    return [
      this.field(store, 'title', title, lintTitle(title, 30, store)),
      this.field(
        store,
        'shortDescription',
        summary,
        lintShortDescription(summary, context, 80),
      ),
      this.field(
        store,
        'description',
        description,
        lintDescription(
          description,
          STORE_FIELD_LIMITS.GOOGLE_PLAY.description!.limit,
        ),
      ),
    ];
  }

  private appStoreFields(
    view: ListingTexts | undefined,
    context: LintContext,
    keywordFieldValue: string,
  ): MetadataFieldAudit[] {
    const store = Store.APP_STORE;
    const title = view?.title ?? '';
    const subtitle = view?.subtitle ?? '';
    const description = view?.description ?? '';
    const keywordField =
      keywordFieldValue.length > 0
        ? [
            this.field(
              store,
              'keywordField',
              keywordFieldValue,
              lintKeywordField(
                keywordFieldValue,
                context,
                KEYWORD_FIELD_BYTE_LIMIT,
              ),
            ),
          ]
        : [];
    return [
      this.field(store, 'title', title, lintTitle(title, 30, store)),
      this.field(
        store,
        'subtitle',
        subtitle,
        lintSubtitle(subtitle, context, 30),
      ),
      ...keywordField,
      this.field(
        store,
        'description',
        description,
        lintDescription(
          description,
          STORE_FIELD_LIMITS.APP_STORE.description!.limit,
        ),
      ),
    ];
  }

  private surfaces(
    store: Store,
    listing: ListingTexts | undefined,
    keywordField: string | null,
  ): Array<{ field: MetadataField; value: string }> {
    const title = { field: 'title' as const, value: listing?.title ?? '' };
    if (store === Store.GOOGLE_PLAY) {
      return [
        title,
        { field: 'shortDescription', value: listing?.summary ?? '' },
        { field: 'description', value: listing?.description ?? '' },
      ];
    }
    const subtitle = {
      field: 'subtitle' as const,
      value: listing?.subtitle ?? '',
    };
    return keywordField === null
      ? [title, subtitle]
      : [title, subtitle, { field: 'keywordField', value: keywordField }];
  }

  private field(
    store: Store,
    field: MetadataField,
    value: string,
    issues: MetadataFieldAudit['issues'],
  ): MetadataFieldAudit {
    const limit = STORE_FIELD_LIMITS[store][field]!;
    return {
      field,
      value,
      chars: fieldLength(field, value),
      limit: limit.limit,
      indexed: limit.indexed,
      issues,
    };
  }

  private coverageRow(
    item: TrackedKeywordItem,
    surfaces: Array<{ field: MetadataField; value: string }>,
    listingCountry: string,
  ): KeywordCoverageRow {
    const fields: CoverageFieldStatus[] = surfaces.map((surface) => ({
      field: surface.field,
      covered: coversKeyword(surface.value, item.text),
    }));
    return {
      keywordId: item.keywordId,
      text: item.text,
      bucket: item.bucket,
      fields,
      uncovered: fields.every((field) => !field.covered),
      country: item.country,
      listingCountry,
    };
  }

  private suggestion(
    tracked: TrackedKeywordItem[],
    coverage: KeywordCoverageRow[],
  ): KeywordFieldSuggestion {
    const uncovered = new Set(
      coverage.filter((row) => row.uncovered).map((row) => row.keywordId),
    );
    const candidates = tracked
      .filter((item) => uncovered.has(item.keywordId))
      .map((item) => ({
        text: singularize(item.text),
        score: (item.volume ?? 0) * (item.relevance ?? 0),
      }))
      .sort((a, b) => b.score - a.score);

    const added = packKeywordField([
      ...new Set(candidates.map((candidate) => candidate.text).filter(Boolean)),
    ]);
    const value = added.join(',');

    return {
      value,
      charactersUsed: utf8ByteLength(value),
      charactersLimit: KEYWORD_FIELD_BYTE_LIMIT,
      addedTerms: added,
    };
  }

  private async ensureApp(appId: string): Promise<{
    id: string;
    store: Store;
    name: string | null;
    country: string;
  }> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { id: true, store: true, name: true, country: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    return app;
  }
}
