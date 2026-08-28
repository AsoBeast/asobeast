import { reportingDsn, reportingOptions } from './error-reporting';

const DSN = 'https://publickey@errors.example.com/7';
const AUTH_SECRET = '0123456789abcdef0123456789abcdef';

const open = {
  ERROR_TRACKING_DSN: DSN,
  NODE_ENV: 'production',
  BILLING_ENABLED: 'true',
  AUTH_SECRET,
};

describe('reportingDsn', () => {
  it('opens on a dsn in hosted production', () => {
    expect(
      reportingDsn({ dsn: DSN, nodeEnv: 'production', billingEnabled: true }),
    ).toBe(DSN);
  });

  it.each([
    ['no dsn is configured', { dsn: undefined }],
    ['the dsn is blank', { dsn: '   ' }],
    ['the deployment is self hosted', { billingEnabled: false }],
    ['this is not production', { nodeEnv: 'development' }],
  ])('stays closed when %s', (_reason, override) => {
    expect(
      reportingDsn({
        dsn: DSN,
        nodeEnv: 'production',
        billingEnabled: true,
        ...override,
      }),
    ).toBeNull();
  });
});

describe('reportingOptions', () => {
  it('builds nothing while the gate is closed', () => {
    expect(
      reportingOptions({ ...open, BILLING_ENABLED: 'false' }),
    ).toBeUndefined();
  });

  it('keeps no breadcrumbs, which would carry the terms a job searched', () => {
    expect(reportingOptions(open)?.maxBreadcrumbs).toBe(0);
  });

  it('drops the nest integration, which reports every failed job attempt', () => {
    const integrations = reportingOptions(open)?.integrations;
    if (typeof integrations !== 'function') {
      throw new Error('the options must filter the default integrations');
    }

    const kept = integrations([
      { name: 'Nest', setupOnce: () => {} },
      { name: 'Http', setupOnce: () => {} },
    ]);

    expect(kept.map((integration) => integration.name)).toEqual(['Http']);
  });

  it('collects nothing the scrubbing promise excludes', () => {
    const options = reportingOptions(open);

    expect(options?.dsn).toBe(DSN);
    expect(options?.environment).toBe('production');
    expect(options?.release).toBeTruthy();
    expect(options?.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      genAI: { inputs: false, outputs: false },
    });
  });

  it('scrubs the secrets it read from the environment', () => {
    const options = reportingOptions(open);

    const event = options?.beforeSend?.(
      { message: `failed for ${AUTH_SECRET}` },
      {},
    );

    expect(JSON.stringify(event)).not.toContain(AUTH_SECRET);
  });
});
