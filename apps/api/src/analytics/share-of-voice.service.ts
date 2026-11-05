import { Injectable } from '@nestjs/common';
import { AppSummary, VisibilityHistory } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, KeywordWindow, TrackedRow } from './analytics.support';
import { BrandKeywords } from './brand-keywords';
import { RivalDates, rivalRankings } from './rival-rankings';
import {
  rivalRows,
  SHARE_DELTA_DAYS,
  shareOfVoicePoints,
  shareOfVoiceSummary,
} from './share-of-voice';

export interface ShareRange {
  from: Date;
  to: Date;
}

interface Voices {
  rows: readonly TrackedRow[];
  rivals: readonly (readonly TrackedRow[])[];
}

interface ShareScope {
  appId: string;
  country: string | undefined;
}

const withoutKeywords = (
  voices: Voices,
  excluded: ReadonlySet<string>,
): Voices => {
  const kept = (rows: readonly TrackedRow[]) =>
    rows.filter((row) => !excluded.has(row.keywordId));
  return { rows: kept(voices.rows), rivals: voices.rivals.map(kept) };
};

export interface ShareContext {
  competitorIds: string[];
  excluded: ReadonlySet<string> | null;
}

function measuredWith<T>(
  voices: Voices,
  excluded: ReadonlySet<string> | null,
  measure: (voices: Voices) => T,
): { shareOfVoice: T; nonBrandedShareOfVoice?: T } {
  return {
    shareOfVoice: measure(voices),
    ...(excluded
      ? { nonBrandedShareOfVoice: measure(withoutKeywords(voices, excluded)) }
      : {}),
  };
}

@Injectable()
export class ShareOfVoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brands: BrandKeywords,
  ) {}

  async context(scope: ShareScope): Promise<ShareContext> {
    const competitors = await this.prisma.app.findMany({
      where: { primaryAppId: scope.appId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const competitorIds = competitors.map(({ id }) => id);
    const excluded =
      competitorIds.length === 0
        ? null
        : await this.brands.excluded(scope.appId, scope.country);
    return { competitorIds, excluded };
  }

  async summary(
    { competitorIds, excluded }: ShareContext,
    { rows, referenceDate }: KeywordWindow,
  ): Promise<Pick<AppSummary, 'shareOfVoice' | 'nonBrandedShareOfVoice'>> {
    const measure = ({ rows, rivals }: Voices) =>
      shareOfVoiceSummary(rows, rivals, referenceDate);
    if (referenceDate === null || competitorIds.length === 0) {
      return {
        shareOfVoice: measure({ rows, rivals: competitorIds.map(() => []) }),
      };
    }
    const voices = await this.voices(rows, competitorIds, {
      in: [referenceDate, addDays(referenceDate, -SHARE_DELTA_DAYS)],
    });
    return measuredWith(voices, excluded, measure);
  }

  async history(
    scope: ShareScope,
    rows: readonly TrackedRow[],
    range: ShareRange,
  ): Promise<
    Pick<VisibilityHistory, 'shareOfVoice' | 'nonBrandedShareOfVoice'>
  > {
    const { competitorIds, excluded } = await this.context(scope);
    if (competitorIds.length === 0) {
      return { shareOfVoice: [] };
    }
    const voices = await this.voices(rows, competitorIds, range);
    return measuredWith(voices, excluded, ({ rows, rivals }) =>
      shareOfVoicePoints(rows, rivals),
    );
  }

  private async voices(
    rows: readonly TrackedRow[],
    competitorIds: readonly string[],
    dates: RivalDates,
  ): Promise<Voices> {
    const rankings = await rivalRankings(
      this.prisma,
      { competitorIds, keywordIds: rows.map((row) => row.keywordId) },
      dates,
    );
    return {
      rows,
      rivals: competitorIds.map((id) =>
        rivalRows(rows, rankings.get(id) ?? new Map()),
      ),
    };
  }
}
