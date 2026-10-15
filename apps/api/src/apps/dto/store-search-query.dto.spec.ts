import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StoreSearchQueryDto } from './store-search-query.dto';

const parse = (query: Record<string, unknown>) =>
  plainToInstance(StoreSearchQueryDto, query);

const errorsOf = async (query: Record<string, unknown>) =>
  (
    await validate(parse(query), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((error) => error.property);

const VALID = { store: 'APP_STORE', country: 'us', q: 'focus' };

describe('StoreSearchQueryDto', () => {
  it('trims the query and defaults the limit to ten', () => {
    const dto = parse({ ...VALID, q: '  focus timer  ' });

    expect(dto.q).toBe('focus timer');
    expect(dto.limit).toBe(10);
  });

  it.each([
    [VALID],
    [{ ...VALID, store: 'GOOGLE_PLAY', country: 'de' }],
    [{ ...VALID, limit: '25' }],
    [{ ...VALID, q: 'a'.repeat(80) }],
  ])('accepts %j', async (query) => {
    await expect(errorsOf(query)).resolves.toEqual([]);
  });

  it.each([
    ['an unknown store', { ...VALID, store: 'OTHER' }, 'store'],
    ['a three letter country', { ...VALID, country: 'usa' }, 'country'],
    ['an empty query', { ...VALID, q: '' }, 'q'],
    ['a blank query', { ...VALID, q: '   ' }, 'q'],
    ['a missing query', { store: 'APP_STORE', country: 'us' }, 'q'],
    ['an over long query', { ...VALID, q: 'a'.repeat(81) }, 'q'],
    ['a limit of zero', { ...VALID, limit: '0' }, 'limit'],
    ['a limit over 25', { ...VALID, limit: '26' }, 'limit'],
    ['a fractional limit', { ...VALID, limit: '2.5' }, 'limit'],
  ])('refuses %s', async (_label, query, property) => {
    await expect(errorsOf(query)).resolves.toEqual([property]);
  });
});
