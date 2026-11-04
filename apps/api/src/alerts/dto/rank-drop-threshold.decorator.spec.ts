import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEmailAlertDto } from './create-email-alert.dto';
import { CreateWebhookDto } from './create-webhook.dto';
import { UpdateEmailAlertDto } from './update-email-alert.dto';
import { UpdateWebhookDto } from './update-webhook.dto';

const DTOS = [
  ['CreateWebhookDto', CreateWebhookDto, { url: 'https://hooks.example.com' }],
  ['UpdateWebhookDto', UpdateWebhookDto, {}],
  ['CreateEmailAlertDto', CreateEmailAlertDto, { email: 'ops@example.com' }],
  ['UpdateEmailAlertDto', UpdateEmailAlertDto, {}],
] as const;

async function check(
  dto: ClassConstructor<object>,
  base: object,
  body: object,
): Promise<{ value: unknown; messages: string[] }> {
  const instance = plainToInstance(dto, {
    ...base,
    events: ['rank.dropped'],
    ...body,
  });
  const errors = await validate(instance, { whitelist: true });
  return {
    value: (instance as { rankDropThreshold?: unknown }).rankDropThreshold,
    messages: errors
      .filter((error) => error.property === 'rankDropThreshold')
      .flatMap((error) => Object.values(error.constraints ?? {})),
  };
}

describe.each(DTOS)('%s rank drop threshold', (_name, dto, base) => {
  it.each([1, 10, 200, null])('accepts %p', async (rankDropThreshold) => {
    await expect(check(dto, base, { rankDropThreshold })).resolves.toEqual({
      value: rankDropThreshold,
      messages: [],
    });
  });

  it('leaves an absent threshold absent', async () => {
    await expect(check(dto, base, {})).resolves.toEqual({
      value: undefined,
      messages: [],
    });
  });

  it.each([0, 201, 1.5, '10', Number.NaN])(
    'refuses %p',
    async (rankDropThreshold) => {
      const { messages } = await check(dto, base, { rankDropThreshold });

      expect(messages.length).toBeGreaterThan(0);
      expect(messages.join(' ')).toContain('rankDropThreshold');
    },
  );
});
