import { Store } from '@prisma/client';
import { StoreAppNotFoundError } from '../../src/store-providers/errors';
import { NormalizedApp, StoreProvider } from '../../src/store-providers/types';

export const PL_APP_URL =
  'https://apps.apple.com/pl/app/where-am-i/id6657987209';
export const US_APP_URL = 'https://apps.apple.com/us/app/fixture/id6657987209';

const shot = (n: number) =>
  `https://is1-ssl.mzstatic.com/image/thumb/a/b/${n}/shot.jpg/392x696bb.jpg`;

export interface Listing {
  title: string;
  subtitle?: string;
  description: string;
  screenshots: string[];
}

export const ENGLISH: Listing = {
  title: 'Where Am I? GeoGuess Map Quiz',
  subtitle: 'World Geography Trivia Game',
  description: 'Discover the world',
  screenshots: [1, 2].map(shot),
};

export const POLISH: Listing = {
  title: 'Where Am I? Quiz Geograficzny',
  subtitle: 'Mapa Świata: Zgadnij Kraj',
  description: 'Odkrywaj świat',
  screenshots: [3, 4].map(shot),
};

export const GERMAN: Listing = {
  title: 'Wo bin ich? Geo Quiz',
  subtitle: 'Welt Geografie Spiel',
  description: 'Entdecke die Welt',
  screenshots: [5, 6].map(shot),
};

export const FRENCH: Listing = {
  title: 'Où suis-je ? Quiz Géo',
  subtitle: 'Jeu de géographie mondiale',
  description: 'Découvrez le monde',
  screenshots: [7, 8].map(shot),
};

export class LocalizedRegistry {
  readonly listings = new Map<string, Listing>();
  readonly calls: Array<{ country: string; localization?: string }> = [];
  readonly unlisted = new Set<string>();
  failing: string | null = null;

  reset(): void {
    this.listings.clear();
    this.calls.length = 0;
    this.unlisted.clear();
    this.failing = null;
  }

  get(store: Store): StoreProvider {
    return {
      store,
      getApp: (storeAppId: string, country: string, localization?: string) => {
        this.calls.push({ country, ...(localization ? { localization } : {}) });
        if (this.unlisted.has(country)) {
          return Promise.reject(new StoreAppNotFoundError(store, storeAppId));
        }
        if (localization !== undefined && localization === this.failing) {
          return Promise.reject(new Error(`lookup failed for ${localization}`));
        }
        const listing =
          this.listings.get(`${country}:${localization ?? 'default'}`) ??
          this.listings.get(`${country}:default`) ??
          ENGLISH;
        return Promise.resolve({
          store,
          storeAppId,
          title: listing.title,
          subtitle: listing.subtitle,
          description: listing.description,
          version: '4.0',
          price: 0,
          raw: { screenshots: listing.screenshots },
          searchable: true,
        } satisfies NormalizedApp);
      },
      search: () => Promise.resolve([]),
      suggest: () => Promise.resolve([]),
      similar: () => Promise.resolve([]),
      topCharts: () => Promise.resolve([]),
      reviews: () => Promise.resolve([]),
      availability: () => Promise.resolve([]),
      developerApps: () => Promise.resolve([]),
    };
  }
}
