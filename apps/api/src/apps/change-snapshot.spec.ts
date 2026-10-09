import { AppSnapshot, Store } from '@prisma/client';
import { toChangeSnapshot } from './change-snapshot';

const SHOT =
  'https://is1-ssl.mzstatic.com/image/thumb/a/b/1/shot.jpg/392x696bb.jpg';

const snapshot = {
  id: 'snap',
  appId: 'app',
  country: null,
  localization: null,
  title: 'Title',
  subtitle: 'Subtitle',
  summary: null,
  description: 'Description',
  ratingAvg: null,
  ratingCount: null,
  installs: null,
  price: 0,
  version: '1.0',
  releasedAt: null,
  storeUpdatedAt: null,
  raw: { screenshots: [SHOT], releaseNotes: 'Bug fixes' },
  capturedAt: new Date('2026-10-08T03:00:00.000Z'),
} satisfies AppSnapshot;

describe('toChangeSnapshot', () => {
  it('reads the comparable fields of a stored app store snapshot', () => {
    expect(toChangeSnapshot(snapshot, 'https://icon', Store.APP_STORE)).toEqual(
      {
        title: 'Title',
        subtitle: 'Subtitle',
        summary: null,
        description: 'Description',
        version: '1.0',
        price: 0,
        screenshotsCount: 1,
        screenshots: [{ key: expect.any(String) as string, url: SHOT }],
        iconUrl: 'https://icon',
        releaseNotes: 'Bug fixes',
      },
    );
  });

  it('reads a stored subtitle that was the primary category as no subtitle', () => {
    expect(
      toChangeSnapshot(
        { ...snapshot, subtitle: 'Finance', raw: { genres: ['Finance'] } },
        null,
        Store.APP_STORE,
      ).subtitle,
    ).toBeNull();
  });

  it('has no screenshot list for a snapshot stored without one', () => {
    expect(
      toChangeSnapshot({ ...snapshot, raw: {} }, null, Store.APP_STORE)
        .screenshots,
    ).toBeNull();
  });
});
