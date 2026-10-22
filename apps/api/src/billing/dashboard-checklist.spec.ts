import { dashboardChecklist } from './dashboard-checklist';

describe('dashboardChecklist', () => {
  it('keeps the seller checklist when this business sells', () => {
    const items = dashboardChecklist(false);

    expect(items).toContainEqual(
      expect.stringContaining('adaptive pricing off'),
    );
    expect(items).toContainEqual(
      expect.stringContaining('SEPA Direct Debit and Cash App Pay off'),
    );
    expect(items.join('\n')).not.toContain('Managed Payments');
  });

  it('asks for activation, the descriptor and threshold monitoring under managed payments', () => {
    const items = dashboardChecklist(true).join('\n');

    expect(items).toContain('Settings, Managed Payments');
    expect(items).toContain('LINK.COM*');
    expect(items).toContain('threshold monitoring');
    expect(items).not.toContain('adaptive pricing off');
  });

  it('keeps the settings both modes share in both lists', () => {
    for (const managed of [false, true]) {
      const items = dashboardChecklist(managed).join('\n');
      expect(items).toContain('limit customers to one subscription');
      expect(items).toContain('Smart Retries');
      expect(items).toContain('ten handled events');
    }
  });

  it('asks for a cancelled trial without a card in both modes', () => {
    for (const managed of [false, true]) {
      expect(dashboardChecklist(managed)).toContain(
        'Settings, Billing, Subscriptions and emails: trial end behaviour, cancel if no payment method; Checkout always collects a card and sets the same in code',
      );
    }
  });

  it('turns on the radar free trial abuse control when this business sells', () => {
    expect(dashboardChecklist(false)).toContain(
      'Radar: free trial abuse control on, with Radar on payment methods saved for future use',
    );
  });

  it('asks stripe about the free trial abuse control under managed payments', () => {
    expect(dashboardChecklist(true)).toContain(
      'Settings, Managed Payments: ask Stripe whether the Radar free trial abuse control applies; Link sends the trial start email and no reminder for a 7 day trial, asobeast sends its own',
    );
  });
});
