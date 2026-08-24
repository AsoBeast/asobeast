import { Injectable, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
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
  normalizeText,
  STORE_FIELD_LIMITS,
  tokenize,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';

const KEYWORD_FIELD_LIMIT = STORE_FIELD_LIMITS.APP_STORE.keywordField!.limit;

const covers = (field: string, keyword: string): boolean =>
  ` ${normalizeText(field)} `.includes(` ${keyword} `);

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
  ) {}

  async audit(appId: string): Promise<MetadataAuditResult> {
    const app = await this.ensureApp(appId);
    const [snapshot, tracked, competitors] = await Promise.all([
      this.prisma.appSnapshot.findFirst({
        where: { appId },
        orderBy: { capturedAt: 'desc' },
        select: {
          title: true,
          subtitle: true,
          summary: true,
          description: true,
        },
      }),
      this.keywords.listTracked(appId),
      this.prisma.app.findMany({
        where: { primaryAppId: appId },
        select: { name: true },
      }),
    ]);

    const active = tracked.filter((item) => item.active);
    const title = snapshot?.title ?? '';
    const subtitle = snapshot?.subtitle ?? '';
    const summary = snapshot?.summary ?? '';
    const description = snapshot?.description ?? '';

    const context: LintContext = {
      titleWords: tokenize(title),
      subtitleWords: tokenize(subtitle),
      brandTokens: tokenize(app.name ?? ''),
      competitorNames: competitors
        .map((competitor) => competitor.name)
        .filter((name): name is string => Boolean(name)),
      trackedKeywords: active.map((item) => item.text),
    };

    if (app.store === Store.GOOGLE_PLAY) {
      const fields: MetadataFieldAudit[] = [
        this.field(app.store, 'title', title, lintTitle(title, 30)),
        this.field(
          app.store,
          'shortDescription',
          summary,
          lintShortDescription(summary, context, 80),
        ),
        this.field(
          app.store,
          'description',
          description,
          lintDescription(
            description,
            STORE_FIELD_LIMITS.GOOGLE_PLAY.description!.limit,
          ),
        ),
      ];
      const coverage = active.map((item) =>
        this.coverageRow(item, [
          { field: 'title', value: title },
          { field: 'shortDescription', value: summary },
          { field: 'description', value: description },
        ]),
      );
      return {
        appId,
        store: app.store,
        fields,
        coverage,
        keywordFieldSuggestion: null,
      };
    }

    const keywordFieldValue = active
      .filter((item) => item.source === 'KEYWORD_FIELD')
      .map((item) => item.text)
      .join(',');

    const fields: MetadataFieldAudit[] = [
      this.field(app.store, 'title', title, lintTitle(title, 30)),
      this.field(
        app.store,
        'subtitle',
        subtitle,
        lintSubtitle(subtitle, context, 30),
      ),
    ];
    if (keywordFieldValue.length > 0) {
      fields.push(
        this.field(
          app.store,
          'keywordField',
          keywordFieldValue,
          lintKeywordField(keywordFieldValue, context, KEYWORD_FIELD_LIMIT),
        ),
      );
    }
    fields.push(
      this.field(
        app.store,
        'description',
        description,
        lintDescription(
          description,
          STORE_FIELD_LIMITS.APP_STORE.description!.limit,
        ),
      ),
    );

    const coverage = active.map((item) =>
      this.coverageRow(item, [
        { field: 'title', value: title },
        { field: 'subtitle', value: subtitle },
        { field: 'keywordField', value: keywordFieldValue },
      ]),
    );

    return {
      appId,
      store: app.store,
      fields,
      coverage,
      keywordFieldSuggestion: this.suggestion(active, coverage),
    };
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
      chars: value.length,
      limit: limit.limit,
      indexed: limit.indexed,
      issues,
    };
  }

  private coverageRow(
    item: TrackedKeywordItem,
    surfaces: Array<{ field: MetadataField; value: string }>,
  ): KeywordCoverageRow {
    const fields: CoverageFieldStatus[] = surfaces.map((surface) => ({
      field: surface.field,
      covered: covers(surface.value, item.text),
    }));
    return {
      keywordId: item.keywordId,
      text: item.text,
      bucket: item.bucket,
      fields,
      uncovered: fields.every((field) => !field.covered),
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

    const added: string[] = [];
    let value = '';
    for (const candidate of candidates) {
      if (!candidate.text || added.includes(candidate.text)) {
        continue;
      }
      const next =
        value.length === 0 ? candidate.text : `${value},${candidate.text}`;
      if (next.length > KEYWORD_FIELD_LIMIT) {
        continue;
      }
      value = next;
      added.push(candidate.text);
    }

    return {
      value,
      charactersUsed: value.length,
      charactersLimit: KEYWORD_FIELD_LIMIT,
      addedTerms: added,
    };
  }

  private async ensureApp(
    appId: string,
  ): Promise<{ id: string; store: Store; name: string | null }> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { id: true, store: true, name: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    return app;
  }
}
