import { Injectable } from '@nestjs/common';
import type { AppLocalizationsResult } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { loadAppMarkets } from './app-markets';
import { toAppLocalizationItems } from './app-localizations';
import { ensureKeywordFieldApp, KeywordApp } from './keywords.support';

@Injectable()
export class AppLocalizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(appId: string): Promise<AppLocalizationsResult> {
    return this.resultOf(await ensureKeywordFieldApp(this.prisma, appId));
  }

  private async resultOf(app: KeywordApp): Promise<AppLocalizationsResult> {
    const [stored, fields, markets] = await Promise.all([
      this.prisma.appLocalization.findMany({
        where: { appId: app.id },
        select: { localization: true, origin: true },
      }),
      this.prisma.keywordField.findMany({
        where: { appId: app.id },
        select: { localization: true, phrases: true, updatedAt: true },
      }),
      loadAppMarkets(this.prisma, app),
    ]);
    return {
      home: app.country,
      markets,
      localizations: toAppLocalizationItems({
        home: app.country,
        markets,
        stored,
        fields,
      }),
    };
  }
}
