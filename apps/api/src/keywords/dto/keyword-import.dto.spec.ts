import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { KEYWORD_IMPORT_LIMIT } from '@asobeast/shared';
import { KeywordImportDto, KeywordImportRowDto } from './keyword-import.dto';

const validated = async (body: Record<string, unknown>) => {
  const dto = plainToInstance(KeywordImportDto, body);
  return {
    dto,
    errors: await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  };
};

const messages = (errors: Awaited<ReturnType<typeof validated>>['errors']) =>
  errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...(error.children ?? []).flatMap((child) =>
      (child.children ?? []).flatMap((leaf) =>
        Object.values(leaf.constraints ?? {}),
      ),
    ),
  ]);

describe('KeywordImportDto', () => {
  it('turns nested rows into instances and keeps every optional field', async () => {
    const { dto, errors } = await validated({
      country: 'pl',
      rows: [
        { keyword: 'habit', country: null, tags: ['core'], note: null },
        { keyword: 'streak' },
      ],
    });

    expect(errors).toEqual([]);
    expect(dto.rows[0]).toBeInstanceOf(KeywordImportRowDto);
    expect(dto.rows[0].tags).toEqual(['core']);
  });

  it.each([[[]], [undefined], ['habit']])(
    'refuses rows that are %j',
    async (rows) => {
      const { errors } = await validated({ rows });

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('rows');
    },
  );

  it('refuses one row more than an import may carry', async () => {
    const rows = Array.from(
      { length: KEYWORD_IMPORT_LIMIT + 1 },
      (_, index) => ({
        keyword: `kw${index}`,
      }),
    );

    const { errors } = await validated({ rows });

    expect(errors[0].constraints).toHaveProperty('arrayMaxSize');
  });

  it('accepts exactly the limit', async () => {
    const rows = Array.from({ length: KEYWORD_IMPORT_LIMIT }, (_, index) => ({
      keyword: `kw${index}`,
    }));

    expect((await validated({ rows })).errors).toEqual([]);
  });

  it('names the row and the field of a nested mistake', async () => {
    const { errors } = await validated({
      rows: [{ keyword: 'ok' }, { keyword: 7, tags: 'core' }],
    });

    expect(errors[0].children?.[0].property).toBe('1');
    expect(messages(errors)).toEqual(
      expect.arrayContaining([
        'keyword must be a string',
        'tags must be an array',
      ]),
    );
  });

  it('refuses a property a row does not declare and a malformed default market', async () => {
    const unknown = await validated({ rows: [{ keyword: 'a', position: 3 }] });
    const market = await validated({
      rows: [{ keyword: 'a' }],
      country: 'USA',
    });

    expect(unknown.errors.length).toBeGreaterThan(0);
    expect(market.errors[0].property).toBe('country');
  });
});
