import { Injectable, NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthorizedKeyword {
  id: string;
  text: string;
  store: Store;
  country: string;
}

@Injectable()
export class TrackedKeywordAccess {
  constructor(private readonly prisma: PrismaService) {}

  async require(keywordId: string): Promise<AuthorizedKeyword> {
    const tracked = await this.prisma.trackedKeyword.findFirst({
      where: { keywordId },
      select: {
        keyword: {
          select: { id: true, text: true, store: true, country: true },
        },
      },
    });
    if (!tracked) {
      throw new NotFoundException(`Keyword ${keywordId} not found`);
    }
    return tracked.keyword;
  }
}
