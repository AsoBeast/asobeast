import { Store } from '@prisma/client';
import { QuotaExceededError } from '../auth/quota.errors';
import type { PrismaService } from '../prisma/prisma.service';
import { readersOf } from '../keywords/localization-markets';
import type {
  KeywordFieldSave,
  KeywordFieldWriter,
  KeywordFieldWrite,
} from '../keywords/keyword-field-writer';
import type { ActionRunQueue } from '../actions/action-run.queue';
import type { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { StoreConnectionService } from './store-connection.service';
import {
  AscKeywordFieldSync,
  FIELD_SYNC_QUOTA_STOPPED,
} from './asc-keyword-field-sync.service';
import { AscError } from './asc-errors';

const APP = {
  id: 'app_1',
  workspaceId: 'ws_1',
  store: Store.APP_STORE,
  country: 'us',
  storeAppId: '1234567890',
};

const quotaRefusal = (): QuotaExceededError =>
  new QuotaExceededError({
    resource: 'keywordMarkets',
    plan: 'free',
    limit: 50,
    used: 50,
    requested: 4,
    upgradeTo: null,
  });

interface BuildOptions {
  status?: 'active' | 'rejected' | null;
  apps?: KeywordAppRow[];
  stored?: { localization: string; phrases: string[] }[];
  live?: { id: string; version: string } | null;
  served?: { locale: string; keywords: string }[];
  abroad?: string[];
  saveFailure?: QuotaExceededError | null;
  priorSync?: boolean;
}

interface KeywordAppRow {
  id: string;
  workspaceId: string;
  store: Store;
  country: string;
  storeAppId: string;
}

function build(options: BuildOptions = {}) {
  const status =
    options.status !== undefined ? options.status : ('active' as const);
  const apps = options.apps ?? [APP];
  const stored = options.stored ?? [];
  const live = options.live ?? { id: 'v1', version: '2.0' };
  const served = options.served ?? [
    { locale: 'en-US', keywords: 'focus,timer' },
  ];
  const abroad = options.abroad ?? [];
  const saveFailure = options.saveFailure ?? null;
  const api = {
    liveVersion: jest.fn().mockResolvedValue(live),
    versionLocalizations: jest.fn().mockResolvedValue(served),
  };
  const connections = {
    openAppStoreListing: jest
      .fn()
      .mockResolvedValue(
        status === null ? null : { id: 'conn_1', status, api },
      ),
  };
  const prisma = {
    app: { findMany: jest.fn().mockResolvedValue(apps) },
    keyword: {
      findMany: jest
        .fn()
        .mockResolvedValue(abroad.map((country) => ({ country }))),
    },
    keywordField: {
      findMany: jest.fn().mockResolvedValue(
        stored.map(({ localization, phrases }) => ({
          localization,
          phrases,
        })),
      ),
    },
    keywordFieldSync: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.priorSync === true ? { appId: APP.id } : null,
        ),
      upsert: jest
        .fn<Promise<unknown>, [Record<string, unknown>]>()
        .mockResolvedValue({}),
    },
  };
  const writer = {
    save: saveFailure
      ? jest
          .fn<Promise<KeywordFieldWrite>, [KeywordFieldSave]>()
          .mockRejectedValue(saveFailure)
      : jest
          .fn<Promise<KeywordFieldWrite>, [KeywordFieldSave]>()
          .mockResolvedValue({ keywordIds: [], trackedIn: ['us'] }),
  };
  const actions = { request: jest.fn().mockResolvedValue({ queued: true }) };
  const workspace = { require: jest.fn(() => 'ws_1') };
  const service = new AscKeywordFieldSync(
    prisma as unknown as PrismaService,
    connections as unknown as StoreConnectionService,
    writer as unknown as KeywordFieldWriter,
    actions as unknown as ActionRunQueue,
    workspace as unknown as WorkspaceContext,
  );
  return { service, api, connections, prisma, writer, actions, workspace };
}

const marketsOf = (abroad: string[]): string[] => ['us', ...[...abroad].sort()];

describe('AscKeywordFieldSync.run', () => {
  it('does nothing without a connection', async () => {
    const { service, prisma } = build({ status: null });

    await expect(service.run()).resolves.toEqual({ fields: 0, changed: 0 });
    expect(prisma.app.findMany).not.toHaveBeenCalled();
  });

  it('imports changed fields, records the sync and reruns the actions', async () => {
    const { service, writer, actions, prisma } = build();

    await expect(service.run()).resolves.toEqual({ fields: 1, changed: 1 });
    expect(writer.save).toHaveBeenCalledWith({
      app: APP,
      localization: 'en-US',
      phrases: ['focus', 'timer'],
      markets: readersOf('en-US', marketsOf([]), 'us').map(
        ({ country }) => country,
      ),
    });
    const [recorded] = prisma.keywordFieldSync.upsert.mock.calls;
    expect(recorded[0]).toMatchObject({
      where: {
        appId_workspaceId: { appId: APP.id, workspaceId: APP.workspaceId },
      },
      update: { version: '2.0', lastError: null },
    });
    expect(actions.request).toHaveBeenCalledWith({ workspaceId: 'ws_1' });
  });

  it('skips the write when Apple still serves the stored phrases', async () => {
    const { service, writer, actions, prisma } = build({
      stored: [{ localization: 'en-US', phrases: ['focus', 'timer'] }],
    });

    await expect(service.run()).resolves.toEqual({ fields: 1, changed: 0 });
    expect(writer.save).not.toHaveBeenCalled();
    expect(prisma.keywordFieldSync.upsert).toHaveBeenCalled();
    expect(actions.request).not.toHaveBeenCalled();
  });

  it('keeps a hand written field when the first import serves none', async () => {
    const { service, writer, actions, prisma } = build({
      stored: [{ localization: 'en-US', phrases: ['focus'] }],
      served: [{ locale: 'en-US', keywords: '' }],
    });

    await expect(service.run()).resolves.toEqual({ fields: 0, changed: 0 });

    expect(writer.save).not.toHaveBeenCalled();
    expect(actions.request).not.toHaveBeenCalled();
    expect(prisma.keywordFieldSync.upsert).toHaveBeenCalled();
  });

  it('clears a field Apple emptied after the first import', async () => {
    const { service, writer } = build({
      stored: [{ localization: 'en-US', phrases: ['focus'] }],
      served: [{ locale: 'en-US', keywords: '' }],
      priorSync: true,
    });

    await service.run();

    expect(writer.save).toHaveBeenCalledWith(
      expect.objectContaining({ localization: 'en-US', phrases: [] }),
    );
  });

  it('ignores a locale AsoBeast does not know', async () => {
    const { service, writer } = build({
      served: [{ locale: 'xx-YY', keywords: 'focus' }],
    });

    await expect(service.run()).resolves.toEqual({ fields: 0, changed: 0 });
    expect(writer.save).not.toHaveBeenCalled();
  });

  it('imports the home localization before additional ones', async () => {
    const { service, writer } = build({
      served: [
        { locale: 'de-DE', keywords: 'fokus,timer' },
        { locale: 'en-US', keywords: 'focus,timer' },
      ],
      abroad: ['de'],
    });

    await service.run();

    expect(writer.save.mock.calls.map(([save]) => save.localization)).toEqual([
      'en-US',
      'de',
    ]);
    expect(writer.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ phrases: ['fokus', 'timer'] }),
    );
  });

  it('drops phrases AsoBeast cannot track', async () => {
    const { service, writer } = build({
      served: [
        {
          locale: 'en-US',
          keywords: 'focus, a sentence with far too many words',
        },
      ],
    });

    await service.run();

    expect(writer.save).toHaveBeenCalledWith(
      expect.objectContaining({ phrases: ['focus'] }),
    );
  });

  it('stops the run at the keyword quota and records the refusal', async () => {
    const { service, api, writer, actions, prisma } = build({
      apps: [APP, { ...APP, id: 'app_2' }],
      saveFailure: quotaRefusal(),
    });

    await expect(service.run()).resolves.toEqual({ fields: 0, changed: 0 });
    expect(writer.save).toHaveBeenCalledTimes(1);
    expect(api.liveVersion).toHaveBeenCalledTimes(1);
    const [refused] = prisma.keywordFieldSync.upsert.mock.calls;
    expect(refused[0]).toMatchObject({
      update: { lastError: FIELD_SYNC_QUOTA_STOPPED('en-US') },
    });
    expect(actions.request).not.toHaveBeenCalled();
  });

  it('skips an app Apple does not serve and imports the next one', async () => {
    const gone = new AscError('gone', 404, 'NOT_FOUND');
    const { service, api, writer, prisma } = build({
      apps: [APP, { ...APP, id: 'app_2' }],
    });
    api.liveVersion
      .mockRejectedValueOnce(gone)
      .mockResolvedValueOnce({ id: 'v1', version: '2.0' });

    await expect(service.run()).resolves.toEqual({ fields: 1, changed: 1 });
    expect(api.liveVersion).toHaveBeenCalledTimes(2);
    expect(writer.save).toHaveBeenCalledTimes(1);
    expect(prisma.keywordFieldSync.upsert).toHaveBeenCalledTimes(1);
  });
});
