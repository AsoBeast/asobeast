import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateWebhookDto } from './create-webhook.dto';
import { UpdateEmailAlertDto } from './update-email-alert.dto';

const DTOS = [
  ['CreateWebhookDto', CreateWebhookDto, { url: 'https://hooks.example.com' }],
  ['UpdateEmailAlertDto', UpdateEmailAlertDto, {}],
] as const;

async function check(
  dto: ClassConstructor<object>,
  base: object,
  body: object,
): Promise<{ reviewScores: unknown; messages: string[] }> {
  const instance = plainToInstance(dto, {
    ...base,
    events: ['review.new'],
    ...body,
  });
  const errors = await validate(instance, { whitelist: true });
  return {
    reviewScores: (instance as { reviewScores?: unknown }).reviewScores,
    messages: errors
      .filter((error) => error.property === 'reviewScores')
      .flatMap((error) => Object.values(error.constraints ?? {})),
  };
}

describe.each(DTOS)('%s review scores', (_name, dto, base) => {
  it.each([
    [
      [2, 1, 2],
      [1, 2],
    ],
    [[1, 2, 3, 4, 5], []],
    [[], []],
  ])('normalizes %j to %j', async (reviewScores, expected) => {
    await expect(check(dto, base, { reviewScores })).resolves.toEqual({
      reviewScores: expected,
      messages: [],
    });
  });

  it('leaves an absent filter absent', async () => {
    await expect(check(dto, base, {})).resolves.toEqual({
      reviewScores: undefined,
      messages: [],
    });
  });

  it.each([
    [[0]],
    [[6]],
    [[1.5]],
    [['1']],
    [[1, 2, 3, 4, 5, 7]],
    [null],
    ['1'],
    [{}],
  ])('refuses %j', async (reviewScores) => {
    const { messages } = await check(dto, base, { reviewScores });

    expect(messages.length).toBeGreaterThan(0);
    expect(messages.join(' ')).toContain('reviewScores');
  });
});
