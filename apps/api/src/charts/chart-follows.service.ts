import { Injectable } from '@nestjs/common';
import {
  CategoryCollection,
  ChartDevice,
  ChartFollowItem,
  ChartKey,
  chartGenreName,
} from '@asobeast/shared';
import { ChartFollow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class ChartFollowsService {
  constructor(private readonly prisma: PrismaService) {}

  async of(key: ChartKey): Promise<ChartFollowItem | null> {
    const follow = await this.prisma.chartFollow.findFirst({ where: key });
    return follow && chartFollowItem(follow);
  }
}
