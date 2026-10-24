import { webhookChannelOf } from '@asobeast/shared';
import { WebhookTargetError } from './webhook-target';

const LEGACY_TEAMS_SUFFIX = '.webhook.office.com';

export function telegramChatId(url: URL): string | null {
  return url.searchParams.get('chat_id') || null;
}

export function assertChannelUrl(raw: string): void {
  const channel = webhookChannelOf(raw);
  if (channel !== 'telegram' && channel !== 'teams') return;
  const url = new URL(raw);
  if (channel === 'telegram' && !telegramChatId(url)) {
    throw new WebhookTargetError(
      'a telegram url needs the chat to post to: add ?chat_id=<id> after sendMessage',
    );
  }
  if (channel === 'teams' && url.hostname.endsWith(LEGACY_TEAMS_SUFFIX)) {
    throw new WebhookTargetError(
      'office 365 connector urls stopped delivering in may 2026; create a workflow with the "send webhook alerts to a channel" template and paste its url',
    );
  }
}
