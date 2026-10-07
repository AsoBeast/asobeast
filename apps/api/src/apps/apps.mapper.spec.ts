import { Store } from '@prisma/client';
import { NormalizedApp } from '../store-providers/types';
import { snapshotIcon, toSnapshotData } from './apps.mapper';

const NORMALIZED: NormalizedApp = {
  store: Store.APP_STORE,
  storeAppId: '1',
  title: 'Habit Tracker',
  description: 'Build habits.',
  raw: { icon: 'https://cdn.test/icon.png' },
  searchable: true,
};

describe('toSnapshotData', () => {
  it('stores no market for the home listing', () => {
    expect(toSnapshotData('app_1', NORMALIZED)).toMatchObject({
      country: null,
    });
  });

  it('stores the market a listing was captured from', () => {
    expect(toSnapshotData('app_1', NORMALIZED, 'de')).toMatchObject({
      country: 'de',
      title: 'Habit Tracker',
    });
  });
});

describe('snapshotIcon', () => {
  it('reads the icon from the captured payload', () => {
    expect(snapshotIcon(Store.APP_STORE, { raw: NORMALIZED.raw })).toBe(
      'https://cdn.test/icon.png',
    );
  });

  it('reads no icon from a payload without one', () => {
    expect(snapshotIcon(Store.GOOGLE_PLAY, { raw: {} })).toBeNull();
  });
});
