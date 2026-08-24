import { UPGRADE_PATH } from '@asobeast/shared';
import type { TrialNoticeDay } from './trial-notices';

export interface AccountMail {
  subject: string;
  body: string[];
}

export function trialNotice(
  day: TrialNoticeDay,
  endsOn: string,
  appUrl: string,
): AccountMail {
  const upgrade = `${appUrl}${UPGRADE_PATH}`;
  const notices: Record<TrialNoticeDay, AccountMail> = {
    0: {
      subject: 'Your asobeast trial has started',
      body: [
        `Your trial runs until ${endsOn}, with the full Indie limits.`,
        'The metadata audit, keyword extraction, competitor discovery and the gap finder work from the first import, so start there.',
        'Rank tracking is daily, so the first positions land tomorrow and trends become readable from day three.',
      ],
    },
    3: {
      subject: 'Your first asobeast rankings are in',
      body: [
        'Three days of positions are recorded, which is enough for the keyword monitor to show movement rather than a single point.',
        'Open the action center to see what changed and what to do about it.',
        `Your trial runs until ${endsOn}. Choose a plan at ${upgrade}.`,
      ],
    },
    5: {
      subject: 'Two days left on your asobeast trial',
      body: [
        `Your trial ends on ${endsOn}.`,
        'Everything collected so far stays yours, whether or not you subscribe.',
        `Keep the daily collection running at ${upgrade}.`,
      ],
    },
    7: {
      subject: 'Your asobeast trial ends today',
      body: [
        'Daily rank checks stop after today unless you choose a plan.',
        'Your apps, keywords, rankings and audits remain readable and exportable either way.',
        `Choose a plan at ${upgrade}.`,
      ],
    },
    8: {
      subject: 'Your asobeast trial has ended',
      body: [
        'Daily collection has stopped, and nothing has been deleted.',
        'You can still read and export everything asobeast collected during the trial.',
        `Pick up where you left off at ${upgrade}.`,
      ],
    },
  };
  return notices[day];
}

export function paymentFailed(portalUrl: string): AccountMail {
  return {
    subject: 'Your asobeast payment did not go through',
    body: [
      'The last charge for your subscription was declined, which is usually an expired card.',
      'Nothing has been switched off. Stripe will retry over the next couple of weeks, and access continues while it does.',
      `Update your payment method at ${portalUrl}.`,
    ],
  };
}

export function downgradeWarning(
  plan: string,
  effectiveOn: string,
  over: { resource: string; used: number; limit: number }[],
  appUrl: string,
): AccountMail {
  return {
    subject: `Your asobeast plan changes to ${plan} on ${effectiveOn}`,
    body: [
      `You are over the ${plan} limits on ${over.map((entry) => entry.resource).join(' and ')}.`,
      ...over.map(
        (entry) =>
          `${entry.resource}: ${entry.used} tracked against a limit of ${entry.limit}.`,
      ),
      'Nothing is deleted. From the effective date the daily run covers the first items in a stable order and leaves the rest untouched.',
      `Choose what to keep before then at ${appUrl}.`,
    ],
  };
}

export function asText(mail: AccountMail): string {
  return `${mail.subject}\n\n${mail.body.join('\n\n')}\n`;
}

export function asHtml(mail: AccountMail): string {
  return mail.body.map((line) => `<p>${line}</p>`).join('');
}
