import {
  APP_STORE_STOREFRONTS,
  storefrontLocalizations,
} from '@asobeast/shared';
import { migrationSql } from './helpers/migration-sql';

describe('the keyword field backfill', () => {
  const sql = migrationSql('add_keyword_fields');
  const named = new Map(
    [...sql.matchAll(/WHEN '([a-z]{2})' THEN '([A-Za-z-]+)'/g)].map(
      ([, country, localization]) => [country, localization],
    ),
  );
  const fallback = /ELSE '([A-Za-z-]+)'/.exec(sql)?.[1];

  it.each([...APP_STORE_STOREFRONTS])(
    'files the field of a %s app under its default localization',
    (country) => {
      expect(named.get(country) ?? fallback).toBe(
        storefrontLocalizations(country)?.primary,
      );
    },
  );
});
