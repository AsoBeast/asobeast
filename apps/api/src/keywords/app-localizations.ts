import {
  APP_STORE_LOCALIZATIONS,
  type AppLocalizationItem,
  type AppLocalizationOrigin,
  type AppStoreLocalization,
  isAppStoreLocalization,
  KEYWORD_FIELD_CHAR_LIMIT,
  keywordFieldChars,
} from '@asobeast/shared';
import { homeLocalization, readersOf } from './localization-markets';

interface StoredLocalization {
  localization: string;
  origin: string;
}

interface StoredField {
  localization: string;
  phrases: readonly string[];
  updatedAt: Date;
}

export interface AppLocalizationInput {
  home: string;
  markets: readonly string[];
  stored: readonly StoredLocalization[];
  fields: readonly StoredField[];
}

const originOf = (origin: string): AppLocalizationOrigin =>
  origin === 'detected' ? 'detected' : 'manual';

const byDisplayName = (left: AppLocalizationItem, right: AppLocalizationItem) =>
  APP_STORE_LOCALIZATIONS[left.localization].localeCompare(
    APP_STORE_LOCALIZATIONS[right.localization],
    'en',
  );

export function toAppLocalizationItems({
  home,
  markets,
  stored,
  fields,
}: AppLocalizationInput): AppLocalizationItem[] {
  const homeTag = homeLocalization(home);
  const origins = new Map<AppStoreLocalization, AppLocalizationOrigin>();
  const saved = new Map<AppStoreLocalization, StoredField>();
  for (const field of fields) {
    if (isAppStoreLocalization(field.localization)) {
      saved.set(field.localization, field);
      origins.set(field.localization, 'manual');
    }
  }
  for (const row of stored) {
    if (isAppStoreLocalization(row.localization)) {
      origins.set(row.localization, originOf(row.origin));
    }
  }
  origins.delete(homeTag);

  const itemOf = (
    localization: AppStoreLocalization,
    origin: AppLocalizationOrigin,
  ): AppLocalizationItem => {
    const field = saved.get(localization);
    const phrases = field ? [...field.phrases] : [];
    return {
      localization,
      origin,
      phrases,
      charactersUsed: keywordFieldChars(phrases),
      charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
      readBy: readersOf(localization, markets, home),
      updatedAt: field ? field.updatedAt.toISOString() : null,
    };
  };

  const others = [...origins]
    .map(([localization, origin]) => itemOf(localization, origin))
    .sort(byDisplayName);
  return [itemOf(homeTag, 'home'), ...others];
}
