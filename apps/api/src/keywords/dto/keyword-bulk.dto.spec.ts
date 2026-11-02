import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  KEYWORD_BULK_ACTIONS,
  KEYWORD_BULK_CHANGE_LIMIT,
} from '@asobeast/shared';
import { KeywordBulkDto } from './keyword-bulk.dto';

const errorsOf = (body: Record<string, unknown>) =>
  validate(plainToInstance(KeywordBulkDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

const ids = (count: number) =>
  Array.from({ length: count }, (_, index) => `kw-${index}`);

describe('KeywordBulkDto', () => {
  it.each(KEYWORD_BULK_ACTIONS)('accepts %s with one id', async (action) => {
    expect(await errorsOf({ action, keywordIds: ['kw-1'] })).toEqual([]);
  });

  it('accepts as many ids as the limit', async () => {
    expect(
      await errorsOf({
        action: 'pause',
        keywordIds: ids(KEYWORD_BULK_CHANGE_LIMIT),
      }),
    ).toEqual([]);
  });

  it.each([
    ['an unknown action', { action: 'archive', keywordIds: ['kw-1'] }],
    ['an empty list', { action: 'pause', keywordIds: [] }],
    [
      'one id over the limit',
      { action: 'pause', keywordIds: ids(KEYWORD_BULK_CHANGE_LIMIT + 1) },
    ],
    ['an id that is not a string', { action: 'pause', keywordIds: [42] }],
    [
      'an id of 65 characters',
      { action: 'pause', keywordIds: ['k'.repeat(65)] },
    ],
    ['a body without ids', { action: 'pause' }],
  ])('refuses %s', async (_case, body) => {
    expect(await errorsOf(body)).not.toEqual([]);
  });
});
