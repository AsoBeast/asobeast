import { Store } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { OcrLanguage } from './ocr-languages';
import { ScreenshotPolicy } from './screenshot-policy';
import { ScreenshotRecorder } from './screenshot-recorder';

interface RecordedRow {
  snapshotId: string;
  workspaceId: string;
  status: string;
  assetKey: string;
}

const SHOTS = [1, 2, 3].map(
  (n) =>
    `https://is1-ssl.mzstatic.com/image/thumb/PurpleSource/v4/aa/bb/${n}/shot.jpg/392x696bb.jpg`,
);

const build = (languages: OcrLanguage[]) => {
  const createMany = jest.fn<
    Promise<{ count: number }>,
    [{ data: RecordedRow[] }]
  >();
  createMany.mockResolvedValue({ count: 0 });
  const tx = {
    snapshotScreenshot: { createMany },
  } as unknown as Prisma.TransactionClient;
  const languagesFor = jest.fn<
    OcrLanguage[],
    [{ store: Store; country: string }]
  >();
  languagesFor.mockReturnValue(languages);
  const policy = { languagesFor } as unknown as ScreenshotPolicy;
  const workspace = {
    require: jest.fn().mockReturnValue('ws_1'),
  } as unknown as WorkspaceContext;
  const recorded = (): RecordedRow[] => createMany.mock.calls[0][0].data;
  return {
    recorder: new ScreenshotRecorder(policy, workspace),
    tx,
    createMany,
    languagesFor,
    recorded,
  };
};

const snapshot = (screenshots: string[] = SHOTS) => ({
  id: 'snap_1',
  raw: { screenshots },
});

const appleApp = { store: Store.APP_STORE, country: 'us' };

describe('ScreenshotRecorder.record', () => {
  it('records pending rows for a readable app and reports how many to read', async () => {
    const { recorder, tx, recorded } = build(['eng']);

    await expect(recorder.record(tx, appleApp, snapshot())).resolves.toBe(3);

    expect(recorded().map((row) => row.status)).toEqual([
      'pending',
      'pending',
      'pending',
    ]);
  });

  it('stamps the snapshot and the workspace of the request on every row', async () => {
    const { recorder, tx, recorded } = build(['eng']);

    await recorder.record(tx, appleApp, snapshot());

    expect(
      recorded().every(
        (row) => row.snapshotId === 'snap_1' && row.workspaceId === 'ws_1',
      ),
    ).toBe(true);
  });

  it('records skipped rows and asks for no read when no language applies', async () => {
    const { recorder, tx, recorded } = build([]);

    await expect(recorder.record(tx, appleApp, snapshot())).resolves.toBe(0);

    expect(recorded().every((row) => row.status === 'skipped')).toBe(true);
  });

  it('records skipped rows for a google play app', async () => {
    const { recorder, tx, recorded } = build([]);

    await recorder.record(
      tx,
      { store: Store.GOOGLE_PLAY, country: 'us' },
      snapshot(['https://play-lh.googleusercontent.com/AbC=w526-h296-rw']),
    );

    expect(recorded()[0]).toMatchObject({
      status: 'skipped',
      assetKey: 'https://play-lh.googleusercontent.com/AbC',
    });
  });

  it('writes nothing for a listing without screenshots', async () => {
    const { recorder, tx, createMany } = build(['eng']);

    await expect(recorder.record(tx, appleApp, snapshot([]))).resolves.toBe(0);

    expect(createMany).not.toHaveBeenCalled();
  });

  it('asks the policy about the storefront of the app', async () => {
    const { recorder, tx, languagesFor } = build(['eng']);

    await recorder.record(
      tx,
      { store: Store.APP_STORE, country: 'jp' },
      snapshot(),
    );

    expect(languagesFor).toHaveBeenCalledWith({
      store: Store.APP_STORE,
      country: 'jp',
    });
  });
});
