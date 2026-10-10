import {
  alertSettingsLink,
  appLink,
  atHost,
  hostOf,
  logoUrl,
  webLink,
} from './email-links';

describe('email links', () => {
  it('builds an absolute link only when the web origin is known', () => {
    expect(webLink(null, '/x')).toBeNull();
    expect(webLink('https://aso.example.com', '/x')).toBe(
      'https://aso.example.com/x',
    );
  });

  it('serves the logo from the web origin', () => {
    expect(logoUrl('https://aso.example.com')).toBe(
      'https://aso.example.com/brand/email-mark.png',
    );
    expect(logoUrl(null)).toBeNull();
  });

  it('names the host with its port', () => {
    expect(hostOf('https://aso.example.com:8443')).toBe('aso.example.com:8443');
    expect(hostOf(null)).toBeNull();
  });

  it('names the instance a sentence came from only when it is known', () => {
    expect(atHost('https://aso.example.com')).toBe(' at aso.example.com');
    expect(atHost(null)).toBe('');
  });

  it('links an app page and the email alert settings', () => {
    expect(appLink('https://aso.example.com', 'app_1')).toBe(
      'https://aso.example.com/apps/app_1',
    );
    expect(alertSettingsLink('https://aso.example.com')).toBe(
      'https://aso.example.com/settings#email-alerts',
    );
    expect(appLink(null, 'app_1')).toBeNull();
    expect(alertSettingsLink(null)).toBeNull();
  });
});
