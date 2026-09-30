import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateWebhookDto } from './create-webhook.dto';
import { UpdateWebhookDto } from './update-webhook.dto';

const DTOS = [
  ['CreateWebhookDto', CreateWebhookDto],
  ['UpdateWebhookDto', UpdateWebhookDto],
] as const;

async function urlMessages(
  dto: ClassConstructor<object>,
  url: string,
): Promise<string[]> {
  const instance = plainToInstance(dto, {
    url,
    events: ['rank.dropped'],
  });
  const errors = await validate(instance, { whitelist: true });
  return errors
    .filter((error) => error.property === 'url')
    .flatMap((error) => Object.values(error.constraints ?? {}));
}

describe.each(DTOS)('%s webhook url', (_name, dto) => {
  it.each([
    'https://hooks.example.com/asobeast',
    'http://172.24.0.2:8080/hook',
    'http://[2606:4700::1111]:8080/hook',
    'http://hooks:8080/x',
    'http://localhost:8080/x',
    'http://LOCALHOST:8080/x',
    'http://my_hooks:8080/x',
    'http://a_b.example.com/x',
    'http://0.0.0.0:8080/x',
    'http://[::1]:8080/x',
    'http://xn--nxasmq6b.example/x',
    `http://${'a'.repeat(63)}:8080/x`,
  ])('leaves %s to the target policy', async (url) => {
    await expect(urlMessages(dto, url)).resolves.toEqual([]);
  });

  it.each([
    'not-a-url',
    'hooks:8080/x',
    '//hooks/x',
    'ftp://hooks/x',
    'file:///etc/passwd',
    'http:///x',
    'http://hooks:99999/x',
    'http://-hooks/x',
    'http://hooks-/x',
    'http://.hooks/x',
    'http://a..b/x',
    'http://localhost./x',
    'http://hooks./x',
    'http://ho ks/x',
    `http://${'a'.repeat(64)}:8080/x`,
    `http://hooks:8080/${'p'.repeat(2100)}`,
    'http://2130706433/x',
    'http://0x7f.1/x',
  ])('refuses %s as a url', async (url) => {
    await expect(urlMessages(dto, url)).resolves.toEqual([
      'url must be a URL address',
    ]);
  });
});
