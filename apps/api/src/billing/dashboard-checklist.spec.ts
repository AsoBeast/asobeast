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
});
