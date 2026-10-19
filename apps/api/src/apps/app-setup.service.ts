import { Injectable, NotFoundException } from '@nestjs/common';
import { AppSetup } from '@prisma/client';
import {
  AppSetupState,
  AppSetupUpdateRequest,
  assertStorefront,
  SETUP_STEPS,
  SetupStatus,
  Store,
} from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { setupStateOf, toSetupState } from './apps.mapper';

function completion(
  status: SetupStatus | undefined,
  current: AppSetup | null,
): { completedAt?: Date | null } {
  if (status === undefined) return {};
  if (status !== 'completed') return { completedAt: null };
  return { completedAt: current?.completedAt ?? new Date() };
}

function assertStorefronts(
  store: Store,
  requested: readonly string[] | undefined,
  held: readonly string[],
): void {
  const accepted = new Set(held);
  for (const market of requested ?? []) {
    if (!accepted.has(market)) assertStorefront(store, market);
  }
}

function changesOf(patch: AppSetupUpdateRequest, current: AppSetup | null) {
  const { skipped } = patch;
  return {
    status: patch.status,
    skipped: skipped && SETUP_STEPS.filter((step) => skipped.includes(step)),
    countriesReviewed: patch.countriesReviewed,
    selectedMarkets: patch.selectedMarkets,
    ...completion(patch.status, current),
  };
}

@Injectable()
export class AppSetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
  ) {}

  async read(appId: string): Promise<AppSetupState> {
    const app = await this.primaryApp(appId);
    return setupStateOf(app);
  }

  async update(
    appId: string,
    patch: AppSetupUpdateRequest,
  ): Promise<AppSetupState> {
    const app = await this.primaryApp(appId);
    assertStorefronts(app.store, patch.selectedMarkets, [
      app.country,
      ...(app.appSetup?.selectedMarkets ?? []),
    ]);
    const changes = changesOf(patch, app.appSetup);
    if (Object.values(changes).every((value) => value === undefined)) {
      return setupStateOf(app);
    }
    const row = await this.prisma.appSetup.upsert({
      where: { appId },
      create: {
        appId,
        workspaceId: this.workspace.require('an app setup'),
        ...changes,
        selectedMarkets: changes.selectedMarkets ?? [app.country],
      },
      update: changes,
    });
    return toSetupState(row);
  }

  async begin(app: { id: string; country: string }): Promise<void> {
    await this.prisma.appSetup.createMany({
      data: [
        {
          appId: app.id,
          workspaceId: this.workspace.require('an app setup'),
          status: 'in_progress',
          selectedMarkets: [app.country],
        },
      ],
      skipDuplicates: true,
    });
  }

  private async primaryApp(appId: string) {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, isCompetitor: false },
      select: { id: true, store: true, country: true, appSetup: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    return app;
  }
}
