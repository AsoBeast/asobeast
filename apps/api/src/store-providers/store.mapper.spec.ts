import { Store } from '@prisma/client';
import { toPrismaStore } from './store.mapper';

describe('toPrismaStore', () => {
  it('maps the shared App Store value to the Prisma enum', () => {
    expect(toPrismaStore('APP_STORE')).toBe(Store.APP_STORE);
  });

  it('maps the shared Google Play value to the Prisma enum', () => {
    expect(toPrismaStore('GOOGLE_PLAY')).toBe(Store.GOOGLE_PLAY);
  });

  it('throws on an unknown store value', () => {
    expect(() => toPrismaStore('WINDOWS_STORE' as never)).toThrow();
  });
});
