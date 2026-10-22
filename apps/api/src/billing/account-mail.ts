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

function legacyTrialNotice(day: TrialNoticeDay, endsOn: string): AccountMail {
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

export interface TrialNoticeContext {
  card: boolean;
  days: number;
  plan: string;
  price: string | null;
  endsOn: string;
  cancelling: boolean;
  chargeFailed: boolean;
}

const BILLING_SETTINGS: AccountMailAction = {
  label: 'Open billing settings',
  path: SETTINGS_PATH,
};

export function trialNotice(
  day: TrialNoticeDay,
  context: TrialNoticeContext,
): AccountMail {
  if (!context.card) return legacyTrialNotice(day, context.endsOn);
  if (day === 8) return cardTrialEnded(context.chargeFailed);
  if (context.price === null) return legacyTrialNotice(day, context.endsOn);
  return cardTrialNotice(day, { ...context, price: context.price });
}

type CardTrialDay = Exclude<TrialNoticeDay, 8>;

function cardTrialNotice(
  day: CardTrialDay,
  {
    days,
    plan,
    price,
    endsOn,
    cancelling,
  }: TrialNoticeContext & {
    price: string;
  },
): AccountMail {
  const notices: Record<CardTrialDay, () => AccountMail> = {
    0: () => ({
      subject: 'Your asobeast trial has started',
      heading: 'Your trial has started',
      body: [
        `Your ${days} day trial of ${plan} runs until ${endsOn}.`,
        `Nothing is charged until then; on ${endsOn} your card is charged ${price} unless you cancel from Settings, Billing.`,
        'The metadata audit, keyword extraction, competitor discovery and the gap finder work from the first import, so start there.',
        'Rank tracking is daily, so the first positions land tomorrow and trends become readable from day three.',
      ],
      action: { label: 'Import your first app', path: '/' },
    }),
    3: () => legacyTrialNotice(3, endsOn),
    5: () => ({
      subject: 'Two days left on your asobeast trial',
      heading: 'Two days left on your trial',
      body: cancelling
        ? [
            `Your trial ends on ${endsOn}. It is cancelled, so nothing is charged.`,
            'Everything collected so far stays yours. Resume the plan from Settings, Billing to keep the daily collection running.',
          ]
        : [
            `On ${endsOn} your card is charged ${price} for ${plan}.`,
            'To stop that, cancel from Settings, Billing before then; everything collected stays yours either way.',
          ],
      action: BILLING_SETTINGS,
    }),
    7: () => ({
      subject: 'Your asobeast trial ends today',
      heading: 'Your trial ends today',
      body: cancelling
        ? [
            'Your trial ends today and nothing is charged.',
            'Daily rank checks stop after today; your apps, keywords, rankings and audits remain readable and exportable.',
          ]
        : [
            `Your trial ends today; your card is charged ${price} at the end of it and the daily collection continues.`,
          ],
      action: cancelling ? CHOOSE_A_PLAN : BILLING_SETTINGS,
    }),
  };
  return notices[day]();
}

function cardTrialEnded(chargeFailed: boolean): AccountMail {
  return {
    subject: 'Your asobeast trial has ended',
    heading: 'Your trial has ended',
    body: [
      'Your trial has ended and collection has stopped. Nothing has been deleted.',
      'You can still read and export everything AsoBeast collected during the trial.',
      chargeFailed
        ? 'The first charge was declined. Update your card in the billing portal and the plan starts as soon as the charge goes through.'
        : 'Choose a plan to start collecting again.',
    ],
    action: chargeFailed
      ? { label: 'Update your card', path: SETTINGS_PATH }
      : CHOOSE_A_PLAN,
  };
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

export function trialChargeFailed(): AccountMail {
  return {
    subject: 'Your asobeast trial ended, but the card was declined',
    heading: 'Your trial ended, but the card was declined',
    body: [
      'The first charge of your plan was declined when the trial ended, so collection is paused.',
      'Nothing has been deleted. Everything collected during the trial stays readable and exportable.',
      'Update your card in the billing portal and the plan starts as soon as the charge goes through.',
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
