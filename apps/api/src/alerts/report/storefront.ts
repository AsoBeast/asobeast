import type { Store } from '@asobeast/shared';
import type { ReportApp } from './report';

const REGIONAL_INDICATOR_A = 0x1f1e6;
const LETTER_A = 65;

export function storefrontFlag(country: string): string | null {
  const code = country.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return String.fromCodePoint(
    ...[...code].map(
      (letter) => REGIONAL_INDICATOR_A + letter.charCodeAt(0) - LETTER_A,
    ),
  );
}

export function storeName(store: Store): string {
  return store === 'GOOGLE_PLAY' ? 'Google Play' : 'App Store';
}

export function storefrontLabel(
  country: string | null,
  withFlag: boolean,
): string {
  if (!country) return '';
  const code = country.toUpperCase();
  const flag = withFlag ? storefrontFlag(code) : null;
  return flag ? `${flag} ${code}` : code;
}

function roleLabel(app: ReportApp): string | null {
  if (app.identity.role === 'competitor') return 'Competitor';
  return app.competitors.length > 0 ? 'Your app' : null;
}

export function identityLine(app: ReportApp, withFlag: boolean): string {
  const { store, country } = app.identity;
  return [
    roleLabel(app),
    store ? storeName(store) : null,
    storefrontLabel(country, withFlag),
  ]
    .filter(Boolean)
    .join(' · ');
}
