import { SETTINGS_PATH } from '@asobeast/shared';
import {
  downgradeWarning,
  paymentFailed,
  trialNotice,
  type AccountMail,
} from './account-mail';
import { TRIAL_NOTICE_DAYS } from './trial-notices';

const OVER = [{ resource: 'keywords', used: 40, limit: 20 }];

const everyNotice = (): AccountMail[] => [
  ...TRIAL_NOTICE_DAYS.map((day) => trialNotice(day, '2026-10-17')),
  paymentFailed(),
  downgradeWarning('Indie', '2026-11-01', OVER),
];

describe('account mail', () => {
  it.each(TRIAL_NOTICE_DAYS)(
    'gives trial day %s a heading, a body and an in app action',
    (day) => {
      const mail = trialNotice(day, '2026-10-17');
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
});
