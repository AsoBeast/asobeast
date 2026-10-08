import { MCP_TOOLS, MCP_WRITE_TOOLS, type ReadTool } from '@asobeast/mcp-tools';
import { toolErrorText } from './tool-errors';

const tool = { name: 'list_apps' } as ReadTool;
const optional = {
  name: 'audit_history',
  unavailableOn404: 'Audit history is not available on this instance.',
} as ReadTool;
const write = MCP_WRITE_TOOLS[0];

describe('toolErrorText', () => {
  it('tells an agent a rejected token will never start working', () => {
    const text = toolErrorText(tool, { status: 401, body: null });

    expect(text).toContain('retrying will not help');
  });

  it('names the upgrade path when the workspace has no plan', () => {
    const text = toolErrorText(tool, {
      status: 402,
      body: {
        message: 'This workspace needs a plan',
        entitlement: { upgradePath: '/upgrade' },
      },
    });

    expect(text).toContain('This workspace needs a plan');
    expect(text).toContain('/upgrade');
  });

  it('marks a refusal as an account state rather than a blip', () => {
    const text = toolErrorText(tool, {
      status: 403,
      body: { message: 'This workspace is suspended' },
    });

    expect(text).toContain('This workspace is suspended');
    expect(text).toContain('retrying will not help');
  });

  it('stops an agent looping on a rate limit', () => {
    const text = toolErrorText(tool, {
      status: 429,
      body: {
        message: 'Rate limit reached',
        rateLimit: { window: 'minute' },
      },
    });

    expect(text).toContain('rather than retrying in a loop');
  });

  it('explains an endpoint an older instance never had', () => {
    const text = toolErrorText(optional, {
      status: 404,
      body: { message: 'Cannot GET /apps/app-1/audit/history' },
    });

    expect(text).toBe(optional.unavailableOn404);
  });

  it('passes an ordinary failure through unchanged', () => {
    expect(
      toolErrorText(tool, { status: 404, body: { message: 'App not found' } }),
    ).toBe('App not found');
  });

  it('describes a response that carried no envelope', () => {
    expect(toolErrorText(tool, { status: 502, body: 'gateway' })).toBe(
      'The asobeast API answered 502.',
    );
  });
});

const mappedTools = MCP_TOOLS.filter(
  (candidate) => candidate.unavailableOn404 !== undefined,
);

describe.each(
  mappedTools.map((candidate) => [candidate.name, candidate] as const),
)('toolErrorText for %s on a 404', (_name, candidate) => {
  it('says the app was not found when the api says so', () => {
    expect(
      toolErrorText(candidate, {
        status: 404,
        body: { message: 'App nope not found' },
      }),
    ).toBe('App nope not found');
  });

  it('says the action was not found when the api says so', () => {
    expect(
      toolErrorText(candidate, {
        status: 404,
        body: { message: 'Action not found' },
      }),
    ).toBe('Action not found');
  });

  it('still says a newer api is needed when the route does not exist', () => {
    expect(
      toolErrorText(candidate, {
        status: 404,
        body: { message: 'Cannot GET /apps/nope/anything' },
      }),
    ).toBe(candidate.unavailableOn404);
  });
});

describe('toolErrorText for a write tool', () => {
  it('tells an agent a spent quota will not clear by retrying', () => {
    const text = toolErrorText(write, {
      status: 403,
      body: { message: 'keywordMarkets limit reached: 1000 of 1000 used' },
    });

    expect(text).toContain('keywordMarkets limit reached');
    expect(text).toContain('retrying will not help');
  });

  it('stops an agent looping on a spent write budget', () => {
    const text = toolErrorText(write, {
      status: 429,
      body: { message: 'Write limit reached', rateLimit: { window: 'minute' } },
    });

    expect(text).toContain('rather than retrying in a loop');
  });

  it('keeps a not found as the api worded it', () => {
    const text = toolErrorText(write, {
      status: 404,
      body: { message: 'App app-9 not found' },
    });

    expect(text).toBe('App app-9 not found');
  });

  it.each([500, 502, 504])(
    'says a write that failed with %s may have been applied',
    (status) => {
      const text = toolErrorText(write, {
        status,
        body: { message: 'The asobeast API could not serve this tool.' },
      });

      expect(text).toContain('may or may not have been applied');
    },
  );

  it('never says that about a read', () => {
    const text = toolErrorText(tool, {
      status: 504,
      body: { message: 'slow' },
    });

    expect(text).toBe('slow');
  });
});
