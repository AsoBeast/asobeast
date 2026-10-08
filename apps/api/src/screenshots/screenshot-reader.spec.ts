import { Store } from '@prisma/client';
import { ScreenshotFetchError } from '../store-providers/errors';
import type { ScreenshotImageSource } from '../store-providers/screenshot-image.source';
import { OCR_LANGUAGES, ocrLanguagesFor } from './ocr-languages';
import { prepareForOcr } from './image-preprocess';
import type { OcrEngine } from './ocr-engine';
import type { CaptionChangeRecorder } from './caption-change-recorder';
import { ScreenshotReader } from './screenshot-reader';
import type { ScreenshotPolicy } from './screenshot-policy';
import type { ScreenshotTextCache } from './screenshot-text-cache';
import type { PrismaService } from '../prisma/prisma.service';

jest.mock('./image-preprocess', () => ({
  prepareForOcr: jest.fn(),
}));

const prepare = prepareForOcr as jest.Mock;

const asset = (n: number) =>
  `https://is1-ssl.mzstatic.com/image/thumb/PurpleSource/v4/aa/bb/${n}/shot.jpg`;

const pendingRow = (position: number) => ({
  snapshotId: 'snap_1',
  workspaceId: 'ws_1',
  position,
  url: `${asset(position)}/392x696bb.jpg`,
  assetKey: asset(position),
  status: 'pending',
  caption: null,
  recipe: null,
  readAt: null,
});

const HEADLINE = [
  { text: 'Track every habit', confidence: 96, top: 198, height: 102 },
  { text: "Today's habits", confidence: 96, top: 720, height: 44 },
];

interface RowUpdate {
  where: { snapshotId_position: { snapshotId: string; position: number } };
  data: { status: string; caption?: string | null; recipe?: string };
}

const build = (
  options: {
    rows?: unknown[];
    country?: string;
    found?: unknown;
    snapshot?: boolean;
    market?: string | null;
    localization?: string | null;
  } = {},
) => {
  const rows = options.rows ?? [pendingRow(1), pendingRow(2)];
  const findMany = jest.fn().mockResolvedValue(rows);
  const update = jest.fn<Promise<unknown>, [RowUpdate]>();
  update.mockResolvedValue({});
  const updateMany = jest.fn().mockResolvedValue({ count: 0 });
  const prisma = {
    appSnapshot: {
      findFirst: jest.fn().mockResolvedValue(
        options.snapshot === false
          ? null
          : {
              id: 'snap_1',
              appId: 'app_1',
              capturedAt: new Date('2026-10-07T03:00:00.000Z'),
              country: options.market ?? null,
              localization: options.localization ?? null,
              app: { store: Store.APP_STORE, country: options.country ?? 'us' },
            },
      ),
    },
    snapshotScreenshot: { findMany, update, updateMany },
  } as unknown as PrismaService;
  const languagesFor = jest.fn(
    (listing: {
      store: Store;
      country: string;
      localization?: string | null;
    }) =>
      ocrLanguagesFor(
        listing.country,
        OCR_LANGUAGES,
        listing.localization ?? null,
      ),
  );
  const policy = { languagesFor } as unknown as ScreenshotPolicy;
  const find = jest.fn().mockResolvedValue(options.found ?? null);
  const store = jest.fn((entry: { status: string; caption: string | null }) =>
    Promise.resolve({ status: entry.status, caption: entry.caption }),
  );
  const cache = { find, store } as unknown as ScreenshotTextCache;
  const download = jest.fn().mockResolvedValue(Buffer.from('bytes'));
  const source = { read: download } as unknown as ScreenshotImageSource;
  const recognize = jest.fn().mockResolvedValue(HEADLINE);
  const engine = {
    name: 'fake-engine',
    read: recognize,
  } as unknown as OcrEngine;
  const captionChanges = { record: jest.fn().mockResolvedValue(undefined) };
  const reader = new ScreenshotReader(
    prisma,
    policy,
    cache,
    source,
    engine,
    captionChanges as unknown as CaptionChangeRecorder,
  );
  const updated = () =>
    update.mock.calls.map(([args]) => [
      args.where.snapshotId_position.position,
      args.data.status,
      args.data.caption,
    ]);
  return {
    reader,
    findMany,
    update,
    updateMany,
    updated,
    find,
    store,
    download,
    recognize,
    languagesFor,
    captionChanges,
  };
};

describe('ScreenshotReader.read', () => {
  beforeEach(() => {
    prepare
      .mockReset()
      .mockResolvedValue({ image: Buffer.from('png'), height: 2341 });
  });

  it('copies a cached read without downloading or reading the image', async () => {
    const { reader, updated, download, recognize } = build({
      found: { status: 'read', caption: 'Cached caption' },
    });

    await reader.read('snap_1');

    expect(updated()).toEqual([
      [1, 'read', 'Cached caption'],
      [2, 'read', 'Cached caption'],
    ]);
    expect(download).not.toHaveBeenCalled();
    expect(recognize).not.toHaveBeenCalled();
  });

  it('downloads, prepares, reads and keeps the headline on a cache miss', async () => {
    const { reader, update, updated, store, download, recognize } = build({
      rows: [pendingRow(1)],
    });

    await reader.read('snap_1');

    expect(download).toHaveBeenCalledWith(pendingRow(1).url);
    expect(recognize).toHaveBeenCalledWith(Buffer.from('png'), ['eng']);
    expect(store).toHaveBeenCalledWith({
      assetKey: asset(1),
      recipe: 'ocr1:eng',
      status: 'read',
      caption: 'Track every habit',
      engine: 'fake-engine',
    });
    expect(updated()).toEqual([[1, 'read', 'Track every habit']]);
    expect(update.mock.calls[0][0].data).toMatchObject({
      recipe: 'ocr1:eng',
    });
  });

  it('caches and records a blank when only interface text was read', async () => {
    const { reader, updated, store, recognize } = build({
      rows: [pendingRow(1)],
    });
    recognize.mockResolvedValue([HEADLINE[1]]);

    await reader.read('snap_1');

    expect(store).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'blank', caption: null }),
    );
    expect(updated()).toEqual([[1, 'blank', null]]);
  });

  it('marks a download that can never succeed as failed and carries on', async () => {
    const { reader, updated, download } = build();
    download
      .mockRejectedValueOnce(new ScreenshotFetchError('gone', false))
      .mockResolvedValueOnce(Buffer.from('bytes'));

    await reader.read('snap_1');

    expect(updated()).toEqual([
      [1, 'failed', undefined],
      [2, 'read', 'Track every habit'],
    ]);
  });

  it('throws on a download worth retrying and leaves the later rows pending', async () => {
    const { reader, update, download } = build();
    download.mockRejectedValueOnce(new ScreenshotFetchError('busy', true));

    await expect(reader.read('snap_1')).rejects.toThrow('busy');

    expect(update).not.toHaveBeenCalled();
  });

  it('treats bytes that are not an image as a failed screenshot', async () => {
    const { reader, updated } = build({ rows: [pendingRow(1)] });
    prepare.mockRejectedValue(
      new Error('Input buffer contains unsupported image format'),
    );

    await reader.read('snap_1');

    expect(updated()).toEqual([[1, 'failed', undefined]]);
  });

  it('throws when the engine fails so the job is retried', async () => {
    const { reader, update, recognize } = build({
      rows: [pendingRow(1)],
    });
    recognize.mockRejectedValue(new Error('wasm out of memory'));

    await expect(reader.read('snap_1')).rejects.toThrow('wasm out of memory');

    expect(update).not.toHaveBeenCalled();
  });

  it('reads with english and the language of the storefront', async () => {
    const { reader, find, recognize } = build({
      rows: [pendingRow(1)],
      country: 'jp',
    });

    await reader.read('snap_1');

    expect(find).toHaveBeenCalledWith(asset(1), 'ocr1:eng+jpn');
    expect(recognize).toHaveBeenCalledWith(expect.anything(), ['eng', 'jpn']);
  });

  it('reads a market snapshot with the language of its own storefront', async () => {
    const { reader, find, recognize } = build({
      rows: [pendingRow(1)],
      country: 'us',
      market: 'de',
    });

    await reader.read('snap_1');

    expect(find).toHaveBeenCalledWith(asset(1), 'ocr1:eng+deu');
    expect(recognize).toHaveBeenCalledWith(expect.anything(), ['eng', 'deu']);
  });

  it('reads a localized snapshot with the language of its localization', async () => {
    const { reader, find, recognize, captionChanges } = build({
      rows: [pendingRow(1)],
      country: 'us',
      market: 'be',
      localization: 'nl',
    });

    await reader.read('snap_1');

    expect(find).toHaveBeenCalledWith(asset(1), 'ocr1:eng');
    expect(recognize).toHaveBeenCalledWith(expect.anything(), ['eng']);
    expect(captionChanges.record).toHaveBeenCalledWith(
      expect.objectContaining({
        listing: { home: 'us', market: 'be', localization: 'nl' },
      }),
    );
  });

  it('marks every pending screenshot skipped when no language applies', async () => {
    const { reader, updateMany, languagesFor, recognize } = build();
    languagesFor.mockReturnValue([]);

    await reader.read('snap_1');

    expect(updateMany).toHaveBeenCalledWith({
      where: { snapshotId: 'snap_1', status: 'pending' },
      data: { status: 'skipped' },
    });
    expect(recognize).not.toHaveBeenCalled();
  });

  it('does nothing for a snapshot that is gone', async () => {
    const { reader, findMany } = build({ snapshot: false });

    await reader.read('snap_1');

    expect(findMany).not.toHaveBeenCalled();
  });

  it('looks only at pending rows, in order', async () => {
    const { reader, findMany } = build({ rows: [] });

    await reader.read('snap_1');

    expect(findMany).toHaveBeenCalledWith({
      where: { snapshotId: 'snap_1', status: 'pending' },
      orderBy: { position: 'asc' },
    });
  });

  it('records caption changes once every pending screenshot is settled', async () => {
    const { reader, captionChanges } = build();

    await reader.read('snap_1');

    expect(captionChanges.record).toHaveBeenCalledTimes(1);
    expect(captionChanges.record).toHaveBeenCalledWith({
      id: 'snap_1',
      appId: 'app_1',
      capturedAt: new Date('2026-10-07T03:00:00.000Z'),
      listing: { home: 'us', market: 'us', localization: null },
    });
  });

  it('records the caption changes of a market snapshot against its own market', async () => {
    const { reader, captionChanges } = build({ market: 'de' });

    await reader.read('snap_1');

    expect(captionChanges.record).toHaveBeenCalledWith(
      expect.objectContaining({
        listing: { home: 'us', market: 'de', localization: null },
      }),
    );
  });

  it('does not record a caption change when a read is interrupted', async () => {
    const { reader, captionChanges, download } = build();
    download.mockRejectedValueOnce(new ScreenshotFetchError('busy', true));

    await expect(reader.read('snap_1')).rejects.toThrow('busy');

    expect(captionChanges.record).not.toHaveBeenCalled();
  });
});

describe('ScreenshotReader.abandon', () => {
  it('marks what is still pending failed so a rejected job leaves no row waiting', async () => {
    const { reader, updateMany } = build();

    await reader.abandon('snap_1');

    expect(updateMany).toHaveBeenCalledWith({
      where: { snapshotId: 'snap_1', status: 'pending' },
      data: { status: 'failed' },
    });
  });
});
