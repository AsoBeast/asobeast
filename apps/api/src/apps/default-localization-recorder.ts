import { Injectable, Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import { serializeKeywordField } from '../keywords/keyword-field-writer';
import { PrismaService } from '../prisma/prisma.service';
import { extractRawFacts } from '../store-providers/raw-facts';
import {
  ListedApp,
  LocalizedCapture,
} from './localized-listing-capture.service';
import { consoleListingOf, staleConsoleListing } from './console-listing';
import { provenHomeDefault } from './home-default';

export interface CapturedDefault {
  description: string;
  version: string | null;
  raw: unknown;
}

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class DefaultLocalizationRecorder {
  private readonly logger = new Logger(DefaultLocalizationRecorder.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    app: ListedApp,
    market: string,
    listing: CapturedDefault,
    localized: LocalizedCapture,
  ): Promise<string | null> {
    if (
      market !== app.country ||
      app.isCompetitor ||
      app.store !== Store.APP_STORE ||
      !localized.complete
    ) {
      return app.defaultLocalization;
    }
    try {
      const consoleListing = consoleListingOf(
        await this.prisma.keywordFieldSync.findFirst({
          where: { appId: app.id },
          select: {
            version: true,
            primaryLocale: true,
            descriptionFingerprints: true,
          },
        }),
      );
      if (
        staleConsoleListing(
          consoleListing,
          listing.description,
          listing.version,
        )
      ) {
        return app.defaultLocalization;
      }
      const proven = provenHomeDefault({
        home: app.country,
        description: listing.description,
        probes: localized.probes,
        declared: extractRawFacts(app.store, listing.raw).languages,
        consoleListing,
      });
      if (proven !== app.defaultLocalization) {
        await this.prisma.withTransaction(async (tx) => {
          await serializeKeywordField(tx, app.id);
          await tx.app.update({
            where: { id: app.id },
            data: { defaultLocalization: proven },
          });
        });
      }
      return proven;
    } catch (error: unknown) {
      this.logger.warn(
        `could not record the default localization of ${app.id}: ${reason(error)}`,
      );
      return app.defaultLocalization;
    }
  }
}
