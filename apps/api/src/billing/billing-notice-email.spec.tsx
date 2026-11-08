import { TRIAL_NOTICE_DAYS } from './trial-notices';
import {
  downgradeWarning,
  paymentFailed,
  trialNotice,
  type TrialNoticeContext,
} from './account-mail';
import { billingNoticeEmail } from './billing-notice-email';

const ORIGIN = 'https://aso.example.com';
const TRIAL: TrialNoticeContext = {
  card: false,
  days: 7,
  plan: 'Indie',
  price: null,
  endsOn: '2026-10-17',
  timeLeft: '3 days',
  cancelling: false,
  chargeFailed: false,
};
const OVER = [
  { resource: 'keywords', used: 40, limit: 20 },
  { resource: 'apps', used: 6, limit: 3 },
];

describe('billingNoticeEmail', () => {
  it('renders the heading, every sentence and the button', async () => {
    const mail = trialNotice(5, TRIAL);
    const { subject, html } = await billingNoticeEmail(mail, ORIGIN);
    expect(subject).toBe('3 days left on your asobeast trial');
    expect(html).toContain('3 days left on your trial');
    for (const line of mail.body) {
      expect(html).toContain(line);
    }
    expect(html).toContain('href="https://aso.example.com/upgrade"');
    expect(html).toContain('Choose a plan');
  });

  it('never links relatively without a web origin', async () => {
    const { html } = await billingNoticeEmail(trialNotice(5, TRIAL), null);
    expect(html).not.toMatch(/href="\//);
    expect(html).not.toContain('Choose a plan</');
  });

  it('escapes the plan name', async () => {
    const { html } = await billingNoticeEmail(
      downgradeWarning('Indie & <Co>', '2026-11-01', OVER),
      ORIGIN,
    );
    expect(html).toContain('Your plan changes to Indie &amp; &lt;Co&gt;');
    expect(html).not.toContain('<Co>');
  });

  it('prints the button address once in the text part', async () => {
    const { text } = await billingNoticeEmail(trialNotice(8, TRIAL), ORIGIN);
    expect(text.split('https://aso.example.com/upgrade').length - 1).toBe(1);
  });

  it('keeps every notice far below the clipping threshold', async () => {
    const notices = [
      ...TRIAL_NOTICE_DAYS.map((day) => trialNotice(day, TRIAL)),
      paymentFailed(),
      downgradeWarning('Indie', '2026-11-01', OVER),
    ];
    for (const mail of notices) {
      const { html } = await billingNoticeEmail(mail, ORIGIN);
      expect(Buffer.byteLength(html)).toBeLessThan(15_000);
    }
  });
});
