import { APP_STORE_STOREFRONTS } from '@asobeast/shared';

const TERRITORY_ALIASES: Record<string, string> = {
  usa: 'us',
  'united states of america': 'us',
  uk: 'gb',
  'great britain': 'gb',
  'korea republic of': 'kr',
  'republic of korea': 'kr',
  korea: 'kr',
  turkey: 'tr',
  'hong kong': 'hk',
  'hong kong sar': 'hk',
  macau: 'mo',
  macao: 'mo',
  'macao sar': 'mo',
  'russian federation': 'ru',
  'viet nam': 'vn',
  'czech republic': 'cz',
  'lao peoples democratic republic': 'la',
  'micronesia federated states of': 'fm',
  'moldova republic of': 'md',
  'tanzania united republic of': 'tz',
  'congo democratic republic of the': 'cd',
  'democratic republic of the congo': 'cd',
  'republic of the congo': 'cg',
  'brunei darussalam': 'bn',
  myanmar: 'mm',
  macedonia: 'mk',
  swaziland: 'sz',
  'cabo verde': 'cv',
  uae: 'ae',
};

const keyOf = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\bst\./g, 'saint')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOREFRONTS = new Set(APP_STORE_STOREFRONTS);

function territoryIndex(): Map<string, string> {
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  const index = new Map<string, string>();
  for (const code of APP_STORE_STOREFRONTS) {
    const name = names.of(code.toUpperCase());
    if (name) index.set(keyOf(name), code);
  }
  for (const [alias, code] of Object.entries(TERRITORY_ALIASES)) {
    index.set(keyOf(alias), code);
  }
  return index;
}

const TERRITORIES = territoryIndex();

export function countryOfTerritory(territory: string): string | null {
  const value = territory.trim().toLowerCase();
  if (STOREFRONTS.has(value)) return value;
  return TERRITORIES.get(keyOf(territory)) ?? null;
}
