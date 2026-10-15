import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CategoryCollection,
  ChartDevice,
  ChartFollowItem,
  ChartKey,
  chartGenreName,
} from '@asobeast/shared';
import { ChartFollow, Prisma } from '@prisma/client';
import { QuotaService } from '../auth/quota.service';
import type { CategoryBucket } from '../category-ranks/category-ranks.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { assertChartKey, chartKeyFrom } from './chart-key';

export interface FollowResult {
  item: ChartFollowItem;
  created: boolean;
}

export function chartFollowItem(follow: ChartFollow): ChartFollowItem {
  return {
    id: follow.id,
    store: follow.store,
    country: follow.country,
    collection: follow.collection as CategoryCollection,
    genre: follow.genre,
    device: follow.device as ChartDevice,
    genreName: chartGenreName(follow.store, follow.genre) ?? follow.genre,
    createdAt: follow.createdAt.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class ChartFollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
    private readonly workspace: WorkspaceContext,
  ) {}

  async follow(query: ChartKey): Promise<FollowResult> {
    const key = chartKeyFrom(query);
    assertChartKey(key);
    const existing = await this.of(key);
    if (existing) return { item: existing, created: false };

    const workspaceId = this.workspace.require('a chart follow');
    try {
      const follow = await this.quota.admitChartFollow((tx) =>
        tx.chartFollow.create({ data: { ...key, workspaceId } }),
      );
      return { item: chartFollowItem(follow), created: true };
    } catch (error) {
      const winner = isUniqueViolation(error) && (await this.of(key));
      if (!winner) throw error;
      return { item: winner, created: false };
    }
  }

  async list(): Promise<ChartFollowItem[]> {
    const follows = await this.prisma.chartFollow.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return follows.map(chartFollowItem);
  }

  async forget(id: string): Promise<void> {
    const { count } = await this.prisma.chartFollow.deleteMany({
      where: { id },
    });
    if (count === 0)
      throw new NotFoundException(`Chart follow ${id} not found`);
  }

  async of(key: ChartKey): Promise<ChartFollowItem | null> {
    const follow = await this.prisma.chartFollow.findFirst({
      where: chartKeyFrom(key),
    });
    return follow && chartFollowItem(follow);
  }

  async buckets(): Promise<CategoryBucket[]> {
    const follows = await this.prisma.chartFollow.findMany({
      select: { store: true, country: true, collection: true, genre: true },
    });
    return follows.map((follow) => ({
      ...follow,
      collection: follow.collection as CategoryCollection,
    }));
  }
}
