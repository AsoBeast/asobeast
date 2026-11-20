import { plainToInstance } from 'class-transformer';
import { IsBoolean, IsOptional, validate } from 'class-validator';
import { BooleanQuery } from './boolean-query.decorator';

class Query {
  @IsOptional()
  @BooleanQuery()
  @IsBoolean()
  flag?: boolean;
}

async function read(flag: unknown): Promise<{ flag: unknown; valid: boolean }> {
  const query = plainToInstance(Query, { flag });
  const errors = await validate(query);
  return { flag: query.flag, valid: errors.length === 0 };
}

describe('BooleanQuery', () => {
  it.each([
    ['true', true],
    ['false', false],
  ])('reads %s as a boolean', async (word, expected) => {
    await expect(read(word)).resolves.toEqual({ flag: expected, valid: true });
  });

  it.each(['yes', '1', 'TRUE', ''])('refuses %p', async (word) => {
    await expect(read(word)).resolves.toEqual({ flag: word, valid: false });
  });

  it('leaves an absent flag absent', async () => {
    await expect(read(undefined)).resolves.toEqual({
      flag: undefined,
      valid: true,
    });
  });
});
