import { Store } from '@prisma/client';
import { QuotaExceededError } from '../auth/quota.errors';
import type { PrismaService } from '../prisma/prisma.service';
import type {
  KeywordFieldSave,
  KeywordFieldWriter,
  KeywordFieldWrite,
} from '../keywords/keyword-field-writer';
import { FieldWriteSupersededError } from '../keywords/keyword-field-writer';
import type { ActionRunQueue } from '../actions/action-run.queue';
import type { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { StoreConnectionService } from './store-connection.service';
import {
  AscKeywordFieldSync,
  FIELD_SYNC_NO_LIVE_VERSION,
  FIELD_SYNC_QUOTA_STOPPED,
  FIELD_SYNC_UNSERVED_APP,
} from './asc-keyword-field-sync.service';
import { AscError } from './asc-errors';

const APP = {
  id: 'app_1',
  workspaceId: 'ws_1',
  store: Store.APP_STORE,
  country: 'us',
  storeAppId: '1234567890',
  isCompetitor: false,
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
  following?: string[];
  apps?: Record<string, KeywordAppRow | undefined>;
  stored?: { localization: string; phrases: string[] }[];
  live?: { id: string; version: string } | null;
  served?: { locale: string; keywords: string }[];
  abroad?: string[];
  saveFailure?: QuotaExceededError | null;
}

interface KeywordAppRow {
  id: string;
  workspaceId: string;
  store: Store;
  country: string;
  storeAppId: string;
  isCompetitor: boolean;
}

interface SyncRecord {
  where: { appId: string };
  data: Record<string, unknown>;
}

function build(options: BuildOptions = {}) {
  const status =
    options.status !== undefined ? options.status : ('active' as const);
  const following = options.following ?? [APP.id];
  const apps = options.apps ?? { [APP.id]: APP };
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
    keywordFieldSync: {
      findMany: jest
        .fn()
        .mockResolvedValue(following.map((appId) => ({ appId }))),
      findFirst: jest.fn().mockResolvedValue({ appId: APP.id }),
      updateMany: jest
        .fn<Promise<{ count: number }>, [SyncRecord]>()
        .mockResolvedValue({ count: 1 }),
    },
    app: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where: { id } }: { where: { id: string } }) =>
          Promise.resolve(apps[id] ?? null),
        ),
    },
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
  };
  const writer = {
    save: saveFailure
      ? jest
          .fn<Promise<KeywordFieldWrite>, [KeywordFieldSave]>()
          .mockRejectedValue(saveFailure)
      : jest
          .fn<Promise<KeywordFieldWrite>, [KeywordFieldSave]>()
          .mockResolvedValue({ keywordIds: [], trackedIn: ['us'] }),
    remove: jest.fn().mockResolvedValue(undefined),
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

describe('AscKeywordFieldSync.run', () => {
  it('does nothing without a connection', async () => {
    const { service, prisma } = build({ status: null });

    await expect(service.run()).resolves.toEqual({ fields: 0, changed: 0 });
    expect(prisma.keywordFieldSync.findMany).not.toHaveBeenCalled();
  });

  it('imports changed fields, records the sync and reruns the actions', async () => {
    const { service, writer, actions, prisma } = build();

    await expect(service.run()).resolves.toEqual({ fields: 1, changed: 1 });
    expect(writer.save).toHaveBeenCalledWith(
      expect.objectContaining({
        app: APP,
        localization: 'en-US',
        phrases: ['focus', 'timer'],
        markets: ['us'],
      }),
    );
    const save = writer.save.mock.calls[0][0];
    expect(save.guard).toBeInstanceOf(Function);
    const recorded = prisma.keywordFieldSync.updateMany.mock.calls[0];
    expect(recorded[0]).toMatchObject({
      where: { appId: APP.id },
      data: { version: '2.0', lastError: null },
    });
    expect(recorded[0].data.syncedAt).toBeInstanceOf(Date);
    expect(actions.request).toHaveBeenCalledWith({ workspaceId: 'ws_1' });
  });

  it('follows only the apps the owner marked, in their order', async () => {
    const second = { ...APP, id: 'app_2', country: 'de' };
    const { service, api, writer } = build({
      following: ['app_2', 'app_1'],
      apps: { [APP.id]: APP, app_2: second },
    });

    await expect(service.run()).resolves.toEqual({ fields: 2, changed: 2 });
    expect(api.liveVersion).toHaveBeenCalledTimes(2);
    expect(writer.save.mock.calls.map(([save]) => save.app.id)).toEqual([
      'app_2',
      'app_1',
    ]);
  });

  it('skips a mark of an app that is gone, a competitor or on Google Play', async () => {
    const { service, api, writer } = build({
      following: ['app_gone', 'app_rival', 'app_play', APP.id],
      apps: {
        [APP.id]: APP,
        app_rival: { ...APP, id: 'app_rival', isCompetitor: true },
        app_play: { ...APP, id: 'app_play', store: Store.GOOGLE_PLAY },
      },
    });

    await expect(service.run()).resolves.toEqual({ fields: 1, changed: 1 });
    expect(api.liveVersion).toHaveBeenCalledTimes(1);
    expect(writer.save).toHaveBeenCalledTimes(1);
  });

  it('skips the write when Apple still serves the stored phrases', async () => {
    const { service, writer, actions, prisma } = build({
      stored: [{ localization: 'en-US', phrases: ['focus', 'timer'] }],
    });

    await expect(service.run()).resolves.toEqual({ fields: 1, changed: 0 });
    expect(writer.save).not.toHaveBeenCalled();
    expect(prisma.keywordFieldSync.updateMany).toHaveBeenCalled();
    expect(actions.request).not.toHaveBeenCalled();
  });

  it('clears a field Apple emptied', async () => {
    const { service, writer } = build({
      stored: [{ localization: 'en-US', phrases: ['focus'] }],
      served: [{ locale: 'en-US', keywords: '' }],
    });

    await service.run();

    expect(writer.save).toHaveBeenCalledWith(
      expect.objectContaining({ localization: 'en-US', phrases: [] }),
    );
  });

  it('counts an empty served field as unchanged when nothing is stored', async () => {
    const { service, writer } = build({
      served: [{ locale: 'en-US', keywords: '' }],
    });

    await expect(service.run()).resolves.toEqual({ fields: 1, changed: 0 });
    expect(writer.save).not.toHaveBeenCalled();
  });

  it('removes the stored fields of localizations Apple no longer serves', async () => {
    const { service, writer, actions } = build({
      stored: [
        { localization: 'en-US', phrases: ['focus'] },
        { localization: 'de', phrases: ['fokus'] },
      ],
      served: [{ locale: 'en-US', keywords: 'focus' }],
      abroad: ['de'],
    });

    await expect(service.run()).resolves.toEqual({ fields: 1, changed: 1 });
    expect(writer.remove).toHaveBeenCalledTimes(1);
    expect(writer.remove).toHaveBeenCalledWith(APP, 'de', expect.any(Function));
    expect(actions.request).toHaveBeenCalledWith({ workspaceId: 'ws_1' });
  });

  it('clears the home field when Apple stops serving it', async () => {
    const { service, writer, actions } = build({
      stored: [
        { localization: 'en-US', phrases: ['focus'] },
        { localization: 'de', phrases: ['fokus'] },
      ],
      served: [{ locale: 'de-DE', keywords: 'fokus' }],
      abroad: ['de'],
    });

    await expect(service.run()).resolves.toEqual({ fields: 1, changed: 1 });
    expect(writer.save).toHaveBeenCalledWith(
      expect.objectContaining({ localization: 'en-US', phrases: [] }),
    );
    expect(writer.remove).not.toHaveBeenCalled();
    expect(actions.request).toHaveBeenCalledWith({ workspaceId: 'ws_1' });
  });

  it('leaves an already empty home field untouched', async () => {
    const { service, writer } = build({
      stored: [
        { localization: 'en-US', phrases: [] },
        { localization: 'de', phrases: ['fokus'] },
      ],
      served: [{ locale: 'de-DE', keywords: 'fokus' }],
      abroad: ['de'],
    });

    await expect(service.run()).resolves.toEqual({ fields: 1, changed: 0 });
    expect(writer.save).not.toHaveBeenCalled();
    expect(writer.remove).not.toHaveBeenCalled();
  });

  it('skips the removals while Apple serves a locale AsoBeast cannot map', async () => {
    const { service, writer } = build({
      stored: [
        { localization: 'en-US', phrases: ['focus'] },
        { localization: 'de', phrases: ['fokus'] },
      ],
      served: [
        { locale: 'en-US', keywords: 'focus' },
        { locale: 'xx-YY', keywords: 'unknown' },
      ],
      abroad: ['de'],
    });

    await expect(service.run()).resolves.toEqual({ fields: 1, changed: 0 });
    expect(writer.remove).not.toHaveBeenCalled();
  });

  it('stops writing and records nothing once the owner stops the import mid run', async () => {
    const { service, writer, prisma } = build({
      served: [
        { locale: 'en-US', keywords: 'focus' },
        { locale: 'de-DE', keywords: 'fokus' },
      ],
      abroad: ['de'],
    });
    prisma.keywordFieldSync.findFirst
      .mockResolvedValueOnce({ appId: APP.id })
      .mockResolvedValueOnce(null);

    await expect(service.run()).resolves.toEqual({ fields: 1, changed: 1 });
    expect(writer.save).toHaveBeenCalledTimes(1);
    expect(writer.remove).not.toHaveBeenCalled();
    expect(prisma.keywordFieldSync.updateMany).not.toHaveBeenCalled();
  });

  it('stops the run when a stop supersedes a field write in the transaction', async () => {
    const { service, writer, prisma } = build({
      served: [
        { locale: 'en-US', keywords: 'focus' },
        { locale: 'de-DE', keywords: 'fokus' },
      ],
      abroad: ['de'],
    });
    writer.save.mockRejectedValueOnce(new FieldWriteSupersededError());

    await expect(service.run()).resolves.toEqual({ fields: 0, changed: 0 });
    expect(writer.save).toHaveBeenCalledTimes(1);
    expect(writer.remove).not.toHaveBeenCalled();
    expect(prisma.keywordFieldSync.updateMany).not.toHaveBeenCalled();
  });

  it('never recreates a removed sync row', async () => {
    const { service, prisma } = build();
    prisma.keywordFieldSync.findFirst.mockResolvedValue(null);

    await expect(service.run()).resolves.toEqual({ fields: 0, changed: 0 });
    expect(prisma.keywordFieldSync.updateMany).not.toHaveBeenCalled();
  });

  it('records why a read was skipped and imports the next app', async () => {
    const gone = new AscError('gone', 404, 'NOT_FOUND');
    const { service, api, writer, prisma } = build({
      following: [APP.id, 'app_2'],
      apps: { [APP.id]: APP, app_2: { ...APP, id: 'app_2' } },
    });
    api.liveVersion
      .mockRejectedValueOnce(gone)
      .mockResolvedValueOnce({ id: 'v1', version: '2.0' });

    await expect(service.run()).resolves.toEqual({ fields: 1, changed: 1 });
    expect(api.liveVersion).toHaveBeenCalledTimes(2);
    expect(writer.save).toHaveBeenCalledTimes(1);
    expect(prisma.keywordFieldSync.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.keywordFieldSync.updateMany.mock.calls[0][0]).toMatchObject({
      where: { appId: APP.id },
      data: { lastError: FIELD_SYNC_UNSERVED_APP },
    });
    expect(
      prisma.keywordFieldSync.updateMany.mock.calls[0][0].data.syncedAt,
    ).toBeUndefined();
    expect(prisma.keywordFieldSync.updateMany.mock.calls[1][0]).toMatchObject({
      where: { appId: 'app_2' },
      data: { version: '2.0', lastError: null },
    });
  });

  it('records the missing live version', async () => {
    const { service, api, prisma } = build();
    api.liveVersion.mockResolvedValue(null);

    await expect(service.run()).resolves.toEqual({ fields: 0, changed: 0 });
    expect(prisma.keywordFieldSync.updateMany.mock.calls[0][0]).toMatchObject({
      data: { lastError: FIELD_SYNC_NO_LIVE_VERSION },
    });
  });

  it('keeps going when one app fails for a reason Apple does not report', async () => {
    const { service, api, writer } = build({
      following: [APP.id, 'app_2'],
      apps: { [APP.id]: APP, app_2: { ...APP, id: 'app_2' } },
    });
    api.liveVersion
      .mockRejectedValueOnce(new Error('transport exploded'))
      .mockResolvedValueOnce({ id: 'v1', version: '2.0' });

    await expect(service.run()).resolves.toEqual({ fields: 1, changed: 1 });
    expect(writer.save).toHaveBeenCalledTimes(1);
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

  it('tracks the phrases only in the markets that read the localization as default', async () => {
    const { service, writer } = build({
      served: [{ locale: 'fr-FR', keywords: 'focus,timer' }],
      abroad: ['fr'],
    });

    await service.run();

    expect(writer.save).toHaveBeenCalledWith(
      expect.objectContaining({ localization: 'fr', markets: ['fr'] }),
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
      following: [APP.id, 'app_2'],
      apps: { [APP.id]: APP, app_2: { ...APP, id: 'app_2' } },
      saveFailure: quotaRefusal(),
    });

    await expect(service.run()).resolves.toEqual({ fields: 0, changed: 0 });
    expect(writer.save).toHaveBeenCalledTimes(1);
    expect(api.liveVersion).toHaveBeenCalledTimes(1);
    const refused = prisma.keywordFieldSync.updateMany.mock.calls[0];
    expect(refused[0]).toMatchObject({
      where: { appId: APP.id },
      data: { lastError: FIELD_SYNC_QUOTA_STOPPED('en-US') },
    });
    expect(refused[0].data.syncedAt).toBeInstanceOf(Date);
    expect(actions.request).not.toHaveBeenCalled();
  });
});
