import { Injectable } from '@nestjs/common';
import { AppSummary, VisibilityHistory } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { addDays, KeywordWindow, TrackedRow } from './analytics.support';
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

@Injectable()
export class ShareOfVoiceService {
  constructor(private readonly prisma: PrismaService) {}

  async competitorIds(appId: string): Promise<string[]> {
    const competitors = await this.prisma.app.findMany({
      where: { primaryAppId: appId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return competitors.map(({ id }) => id);
  }

  async summary(
    competitorIds: readonly string[],
    { rows, referenceDate }: KeywordWindow,
  ): Promise<Pick<AppSummary, 'shareOfVoice'>> {
    const rivals =
      referenceDate === null
        ? competitorIds.map(() => [])
        : await this.rivals(rows, competitorIds, {
            in: [referenceDate, addDays(referenceDate, -SHARE_DELTA_DAYS)],
          });
    return { shareOfVoice: shareOfVoiceSummary(rows, rivals, referenceDate) };
  }

  async history(
    appId: string,
    rows: readonly TrackedRow[],
    range: ShareRange,
  ): Promise<Pick<VisibilityHistory, 'shareOfVoice'>> {
    const competitorIds = await this.competitorIds(appId);
    const rivals = await this.rivals(rows, competitorIds, range);
    return { shareOfVoice: shareOfVoicePoints(rows, rivals) };
  }

  private async rivals(
    rows: readonly TrackedRow[],
    competitorIds: readonly string[],
    dates: RivalDates,
  ): Promise<TrackedRow[][]> {
    const rankings = await rivalRankings(
      this.prisma,
      { competitorIds, keywordIds: rows.map((row) => row.keywordId) },
      dates,
    );
    return competitorIds.map((id) =>
      rivalRows(rows, rankings.get(id) ?? new Map()),
    );
  }
}
