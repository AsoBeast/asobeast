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

async function messagesOf(
  dto: ClassConstructor<object>,
  base: object,
  body: object,
): Promise<string[]> {
  const instance = plainToInstance(dto, {
    ...base,
    events: ['rank.dropped'],
    ...body,
  });
  const errors = await validate(instance, { whitelist: true });
  return errors
    .filter((error) => error.property === 'ratingDropTenths')
    .flatMap((error) => Object.values(error.constraints ?? {}));
}

describe.each(DTOS)('%s rating drop tenths', (_name, dto, base) => {
  it('accepts an absent threshold', async () => {
    await expect(messagesOf(dto, base, {})).resolves.toEqual([]);
  });

  it.each([1, 3, 10])('accepts %p', async (ratingDropTenths) => {
    await expect(messagesOf(dto, base, { ratingDropTenths })).resolves.toEqual(
      [],
    );
  });

  it.each([0, 11, 1.5, '2', null])('refuses %p', async (ratingDropTenths) => {
    const messages = await messagesOf(dto, base, { ratingDropTenths });

    expect(messages.length).toBeGreaterThan(0);
    expect(messages.join(' ')).toContain('ratingDropTenths');
  });
});
