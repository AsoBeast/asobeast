import { Store } from '@prisma/client';
import { StoreAppNotFoundError } from '../../src/store-providers/errors';
import { NormalizedApp, StoreProvider } from '../../src/store-providers/types';

export const PL_APP_URL =
  'https://apps.apple.com/pl/app/where-am-i/id6657987209';
export const US_APP_URL = 'https://apps.apple.com/us/app/fixture/id6657987209';
export const DE_APP_URL = 'https://apps.apple.com/de/app/fixture/id6657987209';
export const JP_APP_URL = 'https://apps.apple.com/jp/app/fixture/id6657987209';

const shot = (n: number) =>
  `https://is1-ssl.mzstatic.com/image/thumb/a/b/${n}/shot.jpg/392x696bb.jpg`;

export interface Listing {
  title: string;
  subtitle?: string;
  description: string;
  screenshots: string[];
  languages?: string[];
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

export const POLISH_ONLY: Listing = {
  title: 'Dzienniczek Ucznia',
  subtitle: 'Oceny i plan lekcji',
  description:
    'Dzienniczek to aplikacja dla uczniów i rodziców. Sprawdzaj oceny, frekwencję i plan lekcji w jednym miejscu. Otrzymuj powiadomienia o nowych ocenach oraz wiadomościach od nauczycieli. Aplikacja działa z dziennikiem szkolnym i jest dostępna dla każdej szkoły, która korzysta z systemu. Wszystkie dane są bezpieczne, a logowanie jest proste i szybkie. Możesz też dodać kilka kont i przełączać się między nimi bez wylogowania.',
  screenshots: [9, 10].map(shot),
  languages: ['PL'],
};

export const ENGLISH_ONLY: Listing = {
  title: 'School Diary',
  subtitle: 'Grades and timetable',
  description:
    'The diary is an app for students and their parents. Check your grades, attendance and timetable in one place. Get a notice about new grades and about messages from your teachers. The app works with the school register and is open to every school that uses the system. All of your data is safe, and signing in is quick and simple. You can also add more than one account and switch between them at any time.',
  screenshots: [11, 12].map(shot),
  languages: ['EN', 'PL'],
};

export const GERMAN_ONLY: Listing = {
  title: 'Schultagebuch',
  subtitle: 'Noten und Stundenplan',
  description:
    'Das Schultagebuch ist eine App für Schüler und ihre Eltern. Sieh dir deine Noten, die Anwesenheit und den Stundenplan an einem Ort an. Du bekommst eine Nachricht über neue Noten und über die Nachrichten von den Lehrern. Die App arbeitet mit dem Klassenbuch der Schule und ist für jede Schule offen, die das System nutzt. Alle deine Daten sind sicher, und die Anmeldung ist einfach und schnell.',
  screenshots: [13, 14].map(shot),
  languages: ['DE'],
};

export const BRITISH_ONLY: Listing = {
  title: 'School Organiser',
  subtitle: 'Colour coded timetable',
  description:
    'The organiser is an app for pupils and their parents. Check your marks, attendance and colour coded timetable in one place. Get a notice about new marks and about messages from your teachers. The app works with the school register and is open to every school that uses the system. All of your data is safe, and signing in is quick and simple. You can also add more than one account and switch between them at any time.',
  screenshots: [15, 16].map(shot),
  languages: ['EN'],
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
          raw: {
            screenshots: listing.screenshots,
            languages: listing.languages ?? [],
          },
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
