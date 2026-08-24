import type { ReadTool } from '@asobeast/mcp-tools';
import { toolErrorText } from './tool-errors';

const tool = { name: 'list_apps' } as ReadTool;
const optional = {
  name: 'audit_history',
  unavailableOn404: 'Audit history is not available on this instance.',
} as ReadTool;

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
    const text = toolErrorText(optional, { status: 404, body: null });

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
