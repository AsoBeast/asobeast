import { UnrecoverableError } from 'bullmq';
import { JobWorkspaceMissingError, requireJobWorkspace } from './job-workspace';
import { JOBS } from './jobs.types';

function job(data: unknown) {
  return { name: JOBS.REFRESH_APP, id: '7', data };
}

describe('requireJobWorkspace', () => {
  it('returns the workspace carried by the payload', () => {
    expect(requireJobWorkspace(job({ appId: 'a1', workspaceId: 'ws_a' }))).toBe(
      'ws_a',
    );
  });

  it('fails loudly rather than defaulting when the payload omits it', () => {
    expect(() => requireJobWorkspace(job({ appId: 'a1' }))).toThrow(
      JobWorkspaceMissingError,
    );
  });

  it('fails loudly on an empty workspace', () => {
    expect(() => requireJobWorkspace(job({ workspaceId: '' }))).toThrow(
      JobWorkspaceMissingError,
    );
  });

  it('fails loudly on a payload that is not an object', () => {
    expect(() => requireJobWorkspace(job(undefined))).toThrow(
      JobWorkspaceMissingError,
    );
  });

  it('names the job in the error', () => {
    expect(() => requireJobWorkspace(job({}))).toThrow(
      `Job ${JOBS.REFRESH_APP} #7 carries no workspaceId`,
    );
  });

  it('is unrecoverable so a pre-upgrade job does not burn every retry', () => {
    expect(() => requireJobWorkspace(job({}))).toThrow(UnrecoverableError);
  });
});
