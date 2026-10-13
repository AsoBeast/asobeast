import { Injectable, Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  WorkspaceFanOut,
  workspaceFailure,
} from '../common/tenancy/workspace-fanout';
import { PrismaService } from '../prisma/prisma.service';
import { LocalizationDetection } from './localization-detection.service';

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class LocalizationSweep {
  private readonly logger = new Logger(LocalizationSweep.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly detection: LocalizationDetection,
    private readonly fanOut: WorkspaceFanOut,
  ) {}

  async run(): Promise<number> {
    const { results, failures } = await this.fanOut.each(
      'the weekly localization sweep covers every workspace',
      () => this.sweepWorkspace(),
    );
    const failure = workspaceFailure(failures, 'failed its localization sweep');
    if (failure) throw failure;
    return results.reduce((total, queued) => total + queued, 0);
  }

  private async sweepWorkspace(): Promise<number> {
    const apps = await this.prisma.app.findMany({
      where: { isCompetitor: false, store: Store.APP_STORE },
      select: { id: true },
    });
    let queued = 0;
    for (const { id } of apps) {
      try {
        const answer = await this.detection.request(id, () =>
          Promise.resolve(),
        );
        queued += answer.queued;
      } catch (error: unknown) {
        this.logger.warn(
          `could not probe the localizations of ${id}, so they wait for the next sweep: ${reason(error)}`,
        );
      }
    }
    return queued;
  }
}
