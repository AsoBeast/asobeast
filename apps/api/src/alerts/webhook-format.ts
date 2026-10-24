import { webhookChannelOf, type AlertPayload } from '@asobeast/shared';
import { discordBody } from './channels/discord';
import { slackBody } from './channels/slack';
import type { AlertReport } from './report/report';
import { buildAlert } from './report/build-alert';
import { buildReport } from './report/build-report';

function reportOf(payload: AlertPayload, origin: string | null): AlertReport {
  return payload.event === 'alerts.batch'
    ? buildReport(payload, origin)
    : buildAlert(payload, origin);
}

export function formatWebhookBody(
  url: string,
  payload: AlertPayload,
  origin: string | null,
): string {
  switch (webhookChannelOf(url)) {
    case 'discord':
      return JSON.stringify(discordBody(reportOf(payload, origin)));
    case 'slack':
      return JSON.stringify(slackBody(reportOf(payload, origin)));
    default:
      return JSON.stringify(payload);
  }
}
