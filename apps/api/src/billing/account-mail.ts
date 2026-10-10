import { SETTINGS_PATH, UPGRADE_PATH } from '@asobeast/shared';
import type { TrialNoticeDay } from './trial-notices';

export interface AccountMailAction {
  label: string;
  path: string;
}

export interface AccountMail {
  subject: string;
  heading: string;
  body: string[];
  action?: AccountMailAction;
}

const CHOOSE_A_PLAN: AccountMailAction = {
  label: 'Choose a plan',
  path: UPGRADE_PATH,
};

export function trialNotice(day: TrialNoticeDay, endsOn: string): AccountMail {
  const notices: Record<TrialNoticeDay, AccountMail> = {
    0: {
      subject: 'Your asobeast trial has started',
      heading: 'Your trial has started',
      body: [
        `Your trial runs until ${endsOn}, with the full Indie limits.`,
        'The metadata audit, keyword extraction, competitor discovery and the gap finder work from the first import, so start there.',
        'Rank tracking is daily, so the first positions land tomorrow and trends become readable from day three.',
      ],
      action: { label: 'Import your first app', path: '/' },
    },
    3: {
      subject: 'Your first asobeast rankings are in',
      heading: 'Your first rankings are in',
      body: [
        'Three days of positions are recorded, which is enough for the keyword monitor to show movement rather than a single point.',
        'Open the action center to see what changed and what to do about it.',
        `Your trial runs until ${endsOn}.`,
      ],
      action: { label: 'Open the Action Center', path: '/actions' },
    },
    5: {
      subject: 'Two days left on your asobeast trial',
      heading: 'Two days left on your trial',
      body: [
        `Your trial ends on ${endsOn}.`,
        'Everything collected so far stays yours, whether or not you subscribe.',
        'Choose a plan to keep the daily collection running.',
      ],
      action: CHOOSE_A_PLAN,
    },
    7: {
      subject: 'Your asobeast trial ends today',
      heading: 'Your trial ends today',
      body: [
        'Daily rank checks stop after today unless you choose a plan.',
        'Your apps, keywords, rankings and audits remain readable and exportable either way.',
      ],
      action: CHOOSE_A_PLAN,
    },
    8: {
      subject: 'Your asobeast trial has ended',
      heading: 'Your trial has ended',
      body: [
        'Daily collection has stopped, and nothing has been deleted.',
        'You can still read and export everything AsoBeast collected during the trial.',
        'Choose a plan to start collecting again.',
      ],
      action: { label: 'Pick up where you left off', path: UPGRADE_PATH },
    },
  };
  return notices[day];
}

export function paymentFailed(): AccountMail {
  return {
    subject: 'Your asobeast payment did not go through',
    heading: 'Your payment did not go through',
    body: [
      'The last charge for your subscription was declined, which is usually an expired card.',
      'Nothing has been switched off. Stripe will retry over the next couple of weeks, and access continues while it does.',
      'Update your payment method to keep the subscription running.',
    ],
    action: { label: 'Update payment method', path: SETTINGS_PATH },
  };
}

export function downgradeWarning(
  plan: string,
  effectiveOn: string,
  over: { resource: string; used: number; limit: number }[],
): AccountMail {
  return {
    subject: `Your asobeast plan changes to ${plan} on ${effectiveOn}`,
    heading: `Your plan changes to ${plan} on ${effectiveOn}`,
    body: [
      `You are over the ${plan} limits on ${over.map((entry) => entry.resource).join(' and ')}.`,
      ...over.map(
        (entry) =>
          `${entry.resource}: ${entry.used} tracked against a limit of ${entry.limit}.`,
      ),
      'Nothing is deleted. From the effective date the daily run covers the first items in a stable order and leaves the rest untouched.',
      'Choose what to keep before then.',
    ],
    action: { label: 'Choose what to keep', path: '/' },
  };
}
