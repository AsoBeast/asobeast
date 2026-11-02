import { assertChannelUrl, telegramChatId } from './webhook-channel-rules';
import { WebhookTargetError } from './webhook-target';

describe('assertChannelUrl', () => {
  it('accepts a telegram url that names its chat', () => {
    expect(() =>
      assertChannelUrl(
        'https://api.telegram.org/bot123:ABC/sendMessage?chat_id=-100',
      ),
    ).not.toThrow();
  });

  it('refuses a telegram url without a chat and says how to fix it', () => {
    expect(() =>
      assertChannelUrl('https://api.telegram.org/bot123:ABC/sendMessage'),
    ).toThrow(
      new WebhookTargetError(
        'a telegram url needs the chat to post to: add ?chat_id=<id> after sendMessage',
      ),
    );
    expect(() =>
      assertChannelUrl(
        'https://api.telegram.org/bot123:ABC/sendMessage?chat_id=',
      ),
    ).toThrow(WebhookTargetError);
  });

  it.each([
    'https://contoso.webhook.office.com/webhookb2/abc',
    'https://outlook.office.com/webhook/abc@def/IncomingWebhook/123/456',
  ])('refuses the retired office 365 connector url %s', (url) => {
    expect(() => assertChannelUrl(url)).toThrow(
      /stopped delivering in may 2026/,
    );
  });

  it('accepts a teams workflow url and any other url', () => {
    for (const url of [
      'https://prod-21.westeurope.logic.azure.com:443/workflows/abc/triggers/manual/paths/invoke?sig=x',
      'https://discord.com/api/webhooks/1/x',
      'https://hooks.example.com/x',
      'https://outlook.office.com/mail/inbox',
    ]) {
      expect(() => assertChannelUrl(url)).not.toThrow();
    }
  });
});

describe('telegramChatId', () => {
  it('reads the chat from the query', () => {
    expect(
      telegramChatId(
        new URL('https://api.telegram.org/bot1:A/sendMessage?chat_id=-100'),
      ),
    ).toBe('-100');
    expect(
      telegramChatId(new URL('https://api.telegram.org/bot1:A/sendMessage')),
    ).toBeNull();
  });
});
