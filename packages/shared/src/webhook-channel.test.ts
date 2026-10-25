import { describe, expect, it } from 'vitest';
import { webhookChannelOf, webhookLabel } from './webhook-channel';

describe('webhookChannelOf', () => {
  it.each([
    ['https://discord.com/api/webhooks/123/abc', 'discord'],
    ['https://discord.com/api/v10/webhooks/123/abc', 'discord'],
    ['https://ptb.discord.com/api/webhooks/123/abc', 'discord'],
    ['https://discordapp.com/api/webhooks/123/abc', 'discord'],
    ['https://Discord.com/api/webhooks/123/abc', 'discord'],
    ['https://discord.com/channels/1/2', 'generic'],
    ['https://hooks.slack.com/services/T1/B2/x', 'slack'],
    ['https://hooks.slack.com/workflows/T1/A2/3/x', 'generic'],
    ['https://hooks.slack.com/triggers/T1/2/x', 'generic'],
    [
      'https://prod-21.westeurope.logic.azure.com:443/workflows/abc/triggers/manual/paths/invoke?sig=x',
      'teams',
    ],
    [
      'https://default1234.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/abc/triggers/manual/paths/invoke?sig=x',
      'teams',
    ],
    ['https://contoso.webhook.office.com/webhookb2/abc', 'teams'],
    [
      'https://api.telegram.org/bot123:ABC/sendMessage?chat_id=-100',
      'telegram',
    ],
    ['https://api.telegram.org/bot123:ABC/sendPhoto', 'generic'],
    [
      'https://chat.googleapis.com/v1/spaces/AAAA/messages?key=k&token=t',
      'google_chat',
    ],
    ['https://hooks.zapier.com/hooks/catch/1/2/', 'generic'],
    ['https://n8n.example.com/webhook/asobeast', 'generic'],
    ['http://hooks:8080/x', 'generic'],
    ['not a url', 'generic'],
  ])('recognises %s as %s', (url, channel) => {
    expect(webhookChannelOf(url)).toBe(channel);
  });
});

describe('webhookLabel', () => {
  it.each([
    [
      'https://discord.com/api/webhooks/123/abc',
      'discord.com/api/webhooks/123/…',
    ],
    [
      'https://discord.com/api/v10/webhooks/123/abc/slack',
      'discord.com/api/v10/webhooks/123/…',
    ],
    [
      'https://hooks.slack.com/services/T0123/B0456/secret',
      'hooks.slack.com/services/T0123/B0456/…',
    ],
    [
      'https://prod-21.westeurope.logic.azure.com:443/workflows/abc/triggers/manual/paths/invoke?sig=secret',
      'prod-21.westeurope.logic.azure.com/workflows/abc/…',
    ],
    [
      'https://api.telegram.org/bot123456:ABC-SECRETTOKEN/sendMessage?chat_id=-100',
      'api.telegram.org/bot…/sendMessage?chat_id=-100',
    ],
    [
      'https://api.telegram.org/bot123456:ABC-SECRETTOKEN/sendMessage',
      'api.telegram.org/bot…/sendMessage',
    ],
    [
      'https://chat.googleapis.com/v1/spaces/AAAAxyz/messages?key=k&token=t',
      'chat.googleapis.com/v1/spaces/AAAAxyz/messages',
    ],
    ['https://webhook.site/6f1c2d3e-uuid/extra', 'webhook.site/…'],
    ['https://hooks.example.com/x?token=secret', 'hooks.example.com/…'],
    ['http://n8n:5678/webhook/asobeast', 'n8n:5678/…'],
    ['https://hooks.example.com/', 'hooks.example.com'],
    ['not a url', 'an invalid url'],
  ])('prints %s as %s', (url, label) => {
    expect(webhookLabel(url)).toBe(label);
  });

  it('tells apart two telegram chats of one bot', () => {
    const bot = 'https://api.telegram.org/bot123456:SECRET/sendMessage';
    expect(webhookLabel(`${bot}?chat_id=1`)).not.toBe(
      webhookLabel(`${bot}?chat_id=2`),
    );
  });
});
