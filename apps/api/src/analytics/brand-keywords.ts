import { Injectable } from '@nestjs/common';
import { KeywordsService } from '../keywords/keywords.service';

@Injectable()
export class BrandKeywords {
  constructor(private readonly keywords: KeywordsService) {}

  async excluded(
    appId: string,
    country: string | undefined,
  ): Promise<ReadonlySet<string> | null> {
    const classes = [...(await this.keywords.keywordClasses(appId, country))];
    if (classes.some(([, keywordClass]) => keywordClass === undefined)) {
      return null;
    }
    return new Set(
      classes
        .filter(([, keywordClass]) => keywordClass !== 'generic')
        .map(([keywordId]) => keywordId),
    );
  }
}
