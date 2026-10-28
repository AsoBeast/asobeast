import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RankCheck } from './rank-confirmation';

export const EARLIER_CHECKS = 2;

@Injectable()
export class EarlierRankings {
  constructor(private readonly prisma: PrismaService) {}

  before(appId: string, keywordId: string, date: Date): Promise<RankCheck[]> {
    return this.prisma.keywordRanking.findMany({
      where: { appId, keywordId, date: { lt: date } },
      orderBy: { date: 'desc' },
      take: EARLIER_CHECKS,
      select: { position: true, depth: true },
    });
  }
}
