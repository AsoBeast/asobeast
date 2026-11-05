import { Injectable } from '@nestjs/common';
import { KeywordsService } from '../keywords/keywords.service';

@Injectable()
export class BrandKeywords {
  constructor(private readonly keywords: KeywordsService) {}

  async excluded(
    appId: string,
    country: string | undefined,
  ): Promise<ReadonlySet<string> | null> {
    const items = await this.keywords.listTracked(appId, undefined, country, {
      brandFacts: true,
    });
    if (items.some((item) => item.keywordClass === undefined)) return null;
    return new Set(
      items
        .filter((item) => item.keywordClass !== 'generic')
        .map((item) => item.keywordId),
    );
  }
}
