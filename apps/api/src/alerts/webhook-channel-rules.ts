import { isRetiredTeamsConnector, webhookChannelOf } from '@asobeast/shared';
import { WebhookTargetError } from './webhook-target';

export function telegramChatId(url: URL): string | null {
  return url.searchParams.get('chat_id') || null;
}

export function assertChannelUrl(raw: string): void {
  if (isRetiredTeamsConnector(raw)) {
    throw new WebhookTargetError(
      'office 365 connector urls stopped delivering in may 2026; create a workflow with the "send webhook alerts to a channel" template and paste its url',
    );
  }
  if (webhookChannelOf(raw) === 'telegram' && !telegramChatId(new URL(raw))) {
    throw new WebhookTargetError(
      'a telegram url needs the chat to post to: add ?chat_id=<id> after sendMessage',
    );
  }
}
