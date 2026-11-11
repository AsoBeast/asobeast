import { SETTINGS_PATH, UPGRADE_PATH } from '@asobeast/shared';
import {
  downgradeWarning,
  paymentFailed,
  trialChargeFailed,
  trialNotice,
  trialRefused,
  type AccountMail,
  type TrialNoticeContext,
} from './account-mail';
import { TRIAL_NOTICE_DAYS } from './trial-notices';

const OVER = [{ resource: 'keywords', used: 40, limit: 20 }];

const TERMS =
  '$10 per month plus any VAT or sales tax, renewing monthly until you cancel';

const CONTEXT: TrialNoticeContext = {
  card: true,
  days: 7,
  plan: 'Indie',
  price: TERMS,
  endsOn: '2026-10-28',
  timeLeft: '3 days',
  cancelling: false,
  chargeFailed: false,
};

const LEGACY: TrialNoticeContext = {
  ...CONTEXT,
  card: false,
  price: null,
  endsOn: '2026-10-17',
};

const card = (
  day: Parameters<typeof trialNotice>[0],
  over: Partial<TrialNoticeContext> = {},
) => trialNotice(day, { ...CONTEXT, ...over });

const everyNotice = (): AccountMail[] => [
  ...TRIAL_NOTICE_DAYS.map((day) => trialNotice(day, LEGACY)),
  ...TRIAL_NOTICE_DAYS.map((day) => card(day)),
  card(5, { cancelling: true }),
  card(8, { chargeFailed: true }),
  paymentFailed(),
  trialChargeFailed(),
  trialRefused(),
  downgradeWarning('Indie', '2026-11-01', OVER),
];

describe('account mail', () => {
  it.each(TRIAL_NOTICE_DAYS)(
    'gives trial day %s a heading, a body and an in app action',
    (day) => {
      const mail = card(day);
      expect(mail.heading).not.toHaveLength(0);
      expect(mail.body.length).toBeGreaterThan(0);
      expect(mail.action?.path).toMatch(/^\//);
    },
  );

  it('keeps every address out of the sentences, so only the button links', () => {
    const sentences = everyNotice().flatMap((mail) => mail.body);
    expect(sentences.filter((line) => /http|\/upgrade/.test(line))).toEqual([]);
  });

  it('sends a failed payment to the billing settings', () => {
    expect(paymentFailed().action?.path).toBe(SETTINGS_PATH);
  });

  it('tells the owner of a declined first charge that the trial is paused', () => {
    const mail = trialChargeFailed();

    expect(mail.subject).toBe(
      'Your asobeast trial ended, but the card was declined',
    );
    expect(mail.heading).toBe('Your trial ended, but the card was declined');
    const body = mail.body.join(' ');
    expect(body).toContain('paused');
    expect(body).toContain('Nothing has been deleted');
    expect(body).toContain('billing portal');
    expect(mail.action).toEqual({
      label: 'Update payment method',
      path: SETTINGS_PATH,
    });
  });

  it('tells the owner a refused trial charged nothing and offers the plans', () => {
    const mail = trialRefused();

    expect(mail.subject).toBe('Your asobeast free trial could not start');
    expect(mail.body[0]).toBe(
      'This card or email has already had a free trial, so this one did not start and nothing was charged.',
    );
    expect(mail.action).toEqual({ label: 'Choose a plan', path: UPGRADE_PATH });
  });

  describe('a card trial', () => {
    it('states the plan, the amount, the date and how to cancel on day 0', () => {
      const mail = card(0);

      expect(mail.body[0]).toBe(
        'Your 7 day trial of Indie runs until 2026-10-28.',
      );
      expect(mail.body.join(' ')).toContain(
        `On 2026-10-28 your card is charged ${TERMS}. Cancel from Settings, Billing before then and nothing is charged.`,
      );
      expect(mail.action?.label).toBe('Import your first app');
    });

    it('names the end date on day 3', () => {
      expect(card(3).body.at(-1)).toBe('Your trial runs until 2026-10-28.');
    });

    it('states the real time left in the reminder subject', () => {
      expect(card(5).subject).toBe('3 days left on your asobeast trial');
      expect(card(5).heading).toBe('3 days left on your trial');
      expect(card(5, { timeLeft: 'less than an hour' }).subject).toBe(
        'Less than an hour left on your asobeast trial',
      );
    });

    it('names the charge and the way out in the reminder', () => {
      const body = card(5).body.join(' ');

      expect(body).toContain(
        `Your Indie trial ends on 2026-10-28. Your card is then charged ${TERMS}.`,
      );
      expect(body).toContain('cancel from Settings, Billing before then');
      expect(card(5).action).toEqual({
        label: 'Open billing settings',
        path: SETTINGS_PATH,
      });
    });

    it('says nothing is charged on day 5 once cancelled', () => {
      const body = card(5, { cancelling: true }).body.join(' ');

      expect(body).toContain('nothing is charged');
      expect(body).not.toContain('your card is charged');
    });

    it('asks for a new card on day 8 when the charge failed, or a plan otherwise', () => {
      expect(card(8, { chargeFailed: true }).action).toEqual({
        label: 'Update your card',
        path: SETTINGS_PATH,
      });
      expect(card(8).action).toEqual({
        label: 'Choose a plan',
        path: UPGRADE_PATH,
      });
    });
  });

  it('falls back to the legacy copy before day 8 when the price is unknown', () => {
    expect(card(0, { price: null }).body[0]).toBe(
      'Your trial runs until 2026-10-28, with the full Indie limits.',
    );
    expect(card(8, { price: null }).action?.label).toBe('Choose a plan');
  });

  describe('a legacy trial', () => {
    it('keeps the copy it was started with', () => {
      expect(trialNotice(0, LEGACY).body[0]).toBe(
        'Your trial runs until 2026-10-17, with the full Indie limits.',
      );
      expect(trialNotice(5, LEGACY).body).toEqual([
        'Your trial ends on 2026-10-17.',
        'Everything collected so far stays yours, whether or not you subscribe.',
        'Choose a plan to keep the daily collection running.',
      ]);
      expect(trialNotice(8, LEGACY).body).toEqual([
        'Daily collection has stopped, and nothing has been deleted.',
        'You can still read and export everything AsoBeast collected during the trial.',
        'Choose a plan to start collecting again.',
      ]);
    });
  });
});
