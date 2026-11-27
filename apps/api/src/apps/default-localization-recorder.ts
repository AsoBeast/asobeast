import { Injectable, Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { extractRawFacts } from '../store-providers/raw-facts';
import {
  ListedApp,
  LocalizedCapture,
} from './localized-listing-capture.service';
import { provenNativeDefault } from './native-default';

export interface CapturedDefault {
  description: string;
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
  ): Promise<void> {
    if (
      market !== app.country ||
      app.isCompetitor ||
      app.store !== Store.APP_STORE ||
      !localized.complete
    ) {
      return;
    }
    try {
      const proven = provenNativeDefault({
        home: app.country,
        description: listing.description,
        probes: localized.probes,
        declared: extractRawFacts(app.store, listing.raw).languages,
      });
      if (proven === app.defaultLocalization) return;
      await this.prisma.app.update({
        where: { id: app.id },
        data: { defaultLocalization: proven },
      });
    } catch (error: unknown) {
      this.logger.warn(
        `could not record the default localization of ${app.id}: ${reason(error)}`,
      );
    }
  }
}
