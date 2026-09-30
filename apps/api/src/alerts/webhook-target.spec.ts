import {
  WebhookTargetError,
  assertDeliverableUrl,
  isBlockedAddress,
} from './webhook-target';

describe('isBlockedAddress', () => {
  const blocked = [
    '127.0.0.1',
    '127.1.2.3',
    '0.0.0.0',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.254',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '192.0.0.1',
    '198.18.0.1',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:169.254.169.254',
    '::ffff:7f00:1',
    '::ffff:a9fe:a9fe',
    '64:ff9b::7f00:1',
    '2002:7f00:0001::',
    '2001:0:1234::1',
    '2001:db8::1',
  ];

  it.each(blocked)('refuses %s', (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  const allowed = ['1.1.1.1', '8.8.8.8', '93.184.216.34', '2606:4700::1111'];

  it.each(allowed)('permits %s', (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });

  it('refuses anything that is not an ip address', () => {
    expect(isBlockedAddress('not-an-ip')).toBe(true);
    expect(isBlockedAddress('')).toBe(true);
    expect(isBlockedAddress('fe80::1%eth0')).toBe(true);
  });
});

describe('assertDeliverableUrl', () => {
  it('accepts a public https url', () => {
    expect(assertDeliverableUrl('https://hooks.example.com/a').hostname).toBe(
      'hooks.example.com',
    );
  });

  it.each([
    'file:///etc/passwd',
    'gopher://example.com/',
    'ftp://example.com/',
    'not a url',
  ])('refuses %s', (url) => {
    expect(() => assertDeliverableUrl(url)).toThrow(WebhookTargetError);
  });

  it.each([
    'http://127.0.0.1/hook',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/hook',
    'http://[::ffff:169.254.169.254]/hook',
    'http://192.168.0.10:8080/hook',
    'http://localhost/hook',
    'http://api.localhost/hook',
    'http://printer.local/hook',
  ])('refuses the private target %s', (url) => {
    expect(() => assertDeliverableUrl(url)).toThrow(WebhookTargetError);
  });

  it('refuses credentials embedded in the url', () => {
    expect(() =>
      assertDeliverableUrl('https://user:pass@example.com/'),
    ).toThrow(WebhookTargetError);
  });

  it('permits any target when private delivery is opted in', () => {
    expect(
      assertDeliverableUrl('http://127.0.0.1/hook', { allowPrivate: true })
        .hostname,
    ).toBe('127.0.0.1');
  });

  it('still refuses a non-http scheme when private delivery is opted in', () => {
    expect(() =>
      assertDeliverableUrl('file:///etc/passwd', { allowPrivate: true }),
    ).toThrow(WebhookTargetError);
  });

  it.each([
    'http://hooks:8080/x',
    'http://n8n:5678/webhook/asobeast',
    'http://HOOKS/x',
    'http://my_hooks:8080/x',
    `http://${'a'.repeat(63)}/x`,
    'http://internal/x',
    'http://例え/x',
  ])('refuses the bare hostname %s', (url) => {
    expect(() => assertDeliverableUrl(url)).toThrow(
      'resolves inside this network',
    );
  });

  it.each([
    'http://localhost./x',
    'http://localhost../x',
    'http://LOCALHOST.:8080/x',
    'http://hooks./x',
    'http://api.localhost./x',
    'http://printer.local./x',
    'http://Printer.LOCAL/x',
    'http://nas.home.arpa./x',
  ])('refuses %s once the trailing dot is ignored', (url) => {
    expect(() => assertDeliverableUrl(url)).toThrow(WebhookTargetError);
  });

  it.each([
    'http://0.0.0.0:8080/x',
    'http://[::]/x',
    'http://[::ffff:7f00:1]:8080/x',
    'http://2130706433/x',
    'http://0x7f.1/x',
    'http://127.1/x',
    'http://127.0.0.1./x',
  ])('refuses the address form %s', (url) => {
    expect(() => assertDeliverableUrl(url)).toThrow(WebhookTargetError);
  });

  it.each([
    'https://hooks.example.com/a',
    'http://a_b.example.com/x',
    'http://xn--nxasmq6b.example/x',
    'http://[2606:4700::1111]:8080/hook',
    'http://1.1.1.1/hook',
  ])('permits the public target %s', (url) => {
    expect(() => assertDeliverableUrl(url)).not.toThrow();
  });

  it.each([
    'http://hooks:8080/x',
    'http://HOOKS:8080/x',
    'http://my_hooks:8080/x',
    'http://localhost:8080/x',
    'http://localhost.:8080/x',
    'http://[::1]:8080/x',
    'http://0.0.0.0:8080/x',
  ])('permits %s when private delivery is opted in', (url) => {
    expect(() =>
      assertDeliverableUrl(url, { allowPrivate: true }),
    ).not.toThrow();
  });

  it('keeps the port and lowercases the hostname of a bare target', () => {
    const url = assertDeliverableUrl('http://HOOKS:8080/x', {
      allowPrivate: true,
    });
    expect(url.hostname).toBe('hooks');
    expect(url.port).toBe('8080');
  });

  it.each(['http://user:pass@hooks:8080/x', 'http://user@localhost/x'])(
    'refuses credentials in %s even when private delivery is opted in',
    (url) => {
      expect(() => assertDeliverableUrl(url, { allowPrivate: true })).toThrow(
        'must not embed credentials',
      );
    },
  );
});
