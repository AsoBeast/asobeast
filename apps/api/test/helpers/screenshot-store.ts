import { Store } from '@prisma/client';
import { StoreProvider } from '../../src/store-providers/types';

export const apple = (n: number) =>
  `https://is1-ssl.mzstatic.com/image/thumb/PurpleSource/v4/aa/bb/${n}/shot.jpg`;
export const appleShot = (n: number) => `${apple(n)}/392x696bb.jpg`;
export const PLAY_SHOT =
  'https://play-lh.googleusercontent.com/AbC=w526-h296-rw';
export const APP_STORE_URL =
  'https://apps.apple.com/us/app/fixture/id1234567890';
export const GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.example.app';

const DEFAULT_SHOTS = [1, 2, 3].map(appleShot);

export class FakeScreenshotRegistry {
  screenshots: string[] = DEFAULT_SHOTS;

  reset(): void {
    this.screenshots = DEFAULT_SHOTS;
  }

  get(store: Store): StoreProvider {
    return {
      store,
      getApp: (storeAppId: string) =>
        Promise.resolve({
          store,
          storeAppId,
          title: 'Fixture App',
          description: 'Fixture description',
          version: '1.0.0',
          price: 0,
          raw: {
            screenshots:
              store === Store.GOOGLE_PLAY ? [PLAY_SHOT] : this.screenshots,
          },
          searchable: true,
        }),
      search: () => Promise.resolve([]),
      suggest: () => Promise.resolve([]),
      similar: () => Promise.resolve([]),
    } as unknown as StoreProvider;
  }
}
