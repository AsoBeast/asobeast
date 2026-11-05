import { Injectable } from '@nestjs/common';
import { AppSummary, VisibilityHistory } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, KeywordWindow, TrackedRow } from './analytics.support';
import { BrandKeywords } from './brand-keywords';
import { RivalDates, rivalRankings } from './rival-rankings';
import {
  rivalRows,
  shareOfVoicePoints,
  shareOfVoiceSummary,
} from './share-of-voice';

const SHARE_DELTA_DAYS = 7;

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

@Injectable()
export class ShareOfVoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brands: BrandKeywords,
  ) {}

  async competitorIds(appId: string): Promise<string[]> {
    const competitors = await this.prisma.app.findMany({
      where: { primaryAppId: appId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return competitors.map(({ id }) => id);
  }

  async summary(
    scope: ShareScope,
    competitorIds: readonly string[],
    { rows, referenceDate }: KeywordWindow,
  ): Promise<Pick<AppSummary, 'shareOfVoice' | 'nonBrandedShareOfVoice'>> {
    const measure = ({ rows, rivals }: Voices) =>
      shareOfVoiceSummary(rows, rivals, referenceDate);
    if (referenceDate === null || competitorIds.length === 0) {
      return {
        shareOfVoice: measure({ rows, rivals: competitorIds.map(() => []) }),
      };
    }
    const [voices, excluded] = await Promise.all([
      this.voices(rows, competitorIds, {
        in: [referenceDate, addDays(referenceDate, -SHARE_DELTA_DAYS)],
      }),
      this.brands.excluded(scope.appId, scope.country),
    ]);
    return {
      shareOfVoice: measure(voices),
      ...(excluded
        ? { nonBrandedShareOfVoice: measure(withoutKeywords(voices, excluded)) }
        : {}),
    };
  }

  async history(
    scope: ShareScope,
    rows: readonly TrackedRow[],
    range: ShareRange,
  ): Promise<
    Pick<VisibilityHistory, 'shareOfVoice' | 'nonBrandedShareOfVoice'>
  > {
    const competitorIds = await this.competitorIds(scope.appId);
    if (competitorIds.length === 0) {
      return { shareOfVoice: [] };
    }
    const [voices, excluded] = await Promise.all([
      this.voices(rows, competitorIds, range),
      this.brands.excluded(scope.appId, scope.country),
    ]);
    const measure = ({ rows, rivals }: Voices) =>
      shareOfVoicePoints(rows, rivals);
    return {
      shareOfVoice: measure(voices),
      ...(excluded
        ? { nonBrandedShareOfVoice: measure(withoutKeywords(voices, excluded)) }
        : {}),
    };
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
