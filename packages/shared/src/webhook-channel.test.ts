import { describe, expect, it } from 'vitest';
import { webhookChannelOf } from './webhook-channel';

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
