import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { KEYWORD_NOTE_MAX_LENGTH } from '@asobeast/shared';
import { UpdateKeywordDto } from './update-keyword.dto';

const validated = async (body: Record<string, unknown>) => {
  const dto = plainToInstance(UpdateKeywordDto, body);
  return { dto, errors: await validate(dto, { whitelist: true }) };
};

describe('UpdateKeywordDto', () => {
  it('stores nine tags that collapse to eight, normalized', async () => {
    const { dto, errors } = await validated({
      tags: ['Core', 'core', 'brand', 'a', 'b', 'c', 'd', 'e', 'f'],
    });

    expect(errors).toEqual([]);
    expect(dto.tags).toEqual(['core', 'brand', 'a', 'b', 'c', 'd', 'e', 'f']);
  });

  it.each([null, ['ok', 7], 'core'])(
    'refuses %j as tags without throwing',
    async (tags) => {
      const { errors } = await validated({ tags });

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('tags');
    },
  );

  it.each(['a'.repeat(25), '#hash'])(
    'refuses the tag %s with a readable message',
    async (tag) => {
      const { errors } = await validated({ tags: [tag] });

      expect(errors).toHaveLength(1);
      expect(Object.values(errors[0].constraints ?? {})).toEqual([
        'each tag is at most 24 letters, numbers, spaces, hyphens or underscores and starts with a letter or number',
      ]);
    },
  );

  it('refuses a note that is not text or is too long', async () => {
    expect((await validated({ note: 12 })).errors).toHaveLength(1);
    expect(
      (await validated({ note: 'x'.repeat(KEYWORD_NOTE_MAX_LENGTH + 1) }))
        .errors,
    ).toHaveLength(1);
  });

  it('stores a blank note as no note', async () => {
    const { dto, errors } = await validated({ note: '  ' });

    expect(errors).toEqual([]);
    expect(dto.note).toBeNull();
  });
});
