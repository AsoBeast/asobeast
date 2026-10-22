import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ANNOTATION_LABEL_MAX_LENGTH } from '@asobeast/shared';
import { CreateAnnotationDto } from './create-annotation.dto';

const validated = async (body: Record<string, unknown>) => {
  const dto = plainToInstance(CreateAnnotationDto, body);
  return { dto, errors: await validate(dto, { whitelist: true }) };
};

describe('CreateAnnotationDto', () => {
  it('accepts a minimal annotation and trims the label', async () => {
    const { dto, errors } = await validated({
      date: '2026-10-08',
      label: '  Release   5.21.0  ',
    });

    expect(errors).toEqual([]);
    expect(dto).toMatchObject({ date: '2026-10-08', label: 'Release 5.21.0' });
  });

  it('normalizes the tag to a lowercase campaign tag', async () => {
    const { dto, errors } = await validated({
      date: '2026-10-08',
      label: 'DE wave',
      market: 'de',
      tag: ' Q4  Wave ',
    });

    expect(errors).toEqual([]);
    expect(dto).toMatchObject({ market: 'de', tag: 'q4 wave' });
  });

  it('refuses a date that is not a real UTC day', async () => {
    expect(
      (await validated({ date: '2026-02-30', label: 'x' })).errors,
    ).toHaveLength(1);
    expect(
      (await validated({ date: '2026-13-01', label: 'x' })).errors,
    ).toHaveLength(1);
    expect(
      (await validated({ date: 'today', label: 'x' })).errors,
    ).toHaveLength(1);
  });

  it('refuses a blank label and one over the limit', async () => {
    expect(
      (await validated({ date: '2026-10-08', label: '   ' })).errors,
    ).toHaveLength(1);
    expect(
      (
        await validated({
          date: '2026-10-08',
          label: 'x'.repeat(ANNOTATION_LABEL_MAX_LENGTH + 1),
        })
      ).errors,
    ).toHaveLength(1);
  });

  it('refuses a market that is not a two letter storefront code', async () => {
    const { errors } = await validated({
      date: '2026-10-08',
      label: 'x',
      market: 'DEU',
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('market');
  });

  it('refuses a null market as a type error, not a storefront miss', async () => {
    const { errors } = await validated({
      date: '2026-10-08',
      label: 'x',
      market: null,
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('market');
  });

  it('refuses a null tag as a type error', async () => {
    const { errors } = await validated({
      date: '2026-10-08',
      label: 'x',
      tag: null,
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('tag');
  });

  it('refuses a tag that is not a campaign tag', async () => {
    const { errors } = await validated({
      date: '2026-10-08',
      label: 'x',
      tag: '#hash',
    });

    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {})).toEqual([
      'tag is at most 24 letters, numbers, spaces, hyphens or underscores and starts with a letter or number',
    ]);
  });
});
