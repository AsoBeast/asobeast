import { APP_STORE_STOREFRONTS } from '@asobeast/shared';
import { homeLocalization } from '../src/keywords/localization-markets';
import { migrationSql } from './helpers/migration-sql';

describe.each(['add_keyword_fields', 'drop_home_app_localizations'])(
  'the home localization the %s migration names',
  (migration) => {
    const sql = migrationSql(migration);
    const named = new Map(
      [...sql.matchAll(/WHEN '([a-z]{2})' THEN '([A-Za-z-]+)'/g)].map(
        ([, country, localization]) => [country, localization],
      ),
    );
    const fallback = /ELSE '([A-Za-z-]+)'/.exec(sql)?.[1];

    it.each([...APP_STORE_STOREFRONTS])(
      'is the default localization of a %s app',
      (country) => {
        expect(named.get(country) ?? fallback).toBe(homeLocalization(country));
      },
    );

    it('falls back to the localization an unlisted home country reads', () => {
      expect(fallback).toBe(homeLocalization('uk'));
    });
  },
);
