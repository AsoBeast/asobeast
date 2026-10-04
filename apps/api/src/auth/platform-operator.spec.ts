import { NotFoundException } from '@nestjs/common';
import { DEFAULT_WORKSPACE_ID } from '../common/tenancy/default-workspace';
import {
  isOperatorWorkspace,
  isPlatformOperator,
  requirePlatformOperator,
} from './platform-operator';

const OPERATOR = { role: 'owner', workspaceId: DEFAULT_WORKSPACE_ID };

describe('operator workspace', () => {
  it('is the bootstrap workspace', () => {
    expect(isOperatorWorkspace(DEFAULT_WORKSPACE_ID)).toBe(true);
  });

  it.each(['ws_tenant', 'WS_DEFAULT', ' ws_default', ''])(
    'is not the workspace %j',
    (workspaceId) => {
      expect(isOperatorWorkspace(workspaceId)).toBe(false);
    },
  );
});

describe('platform operator', () => {
  it('is the owner of the bootstrap workspace', () => {
    expect(isPlatformOperator(OPERATOR)).toBe(true);
  });

  it('is not the owner of any other workspace', () => {
    expect(
      isPlatformOperator({ role: 'owner', workspaceId: 'ws_tenant' }),
    ).toBe(false);
  });

  it('is not a member of the bootstrap workspace', () => {
    expect(isPlatformOperator({ ...OPERATOR, role: 'member' })).toBe(false);
  });

  it('lets the operator through', () => {
    expect(() =>
      requirePlatformOperator(OPERATOR, 'Cannot GET /x'),
    ).not.toThrow();
  });

  it('answers anyone else with a not found that names the route', () => {
    expect(() =>
      requirePlatformOperator({ ...OPERATOR, role: 'member' }, 'Cannot GET /x'),
    ).toThrow(new NotFoundException('Cannot GET /x'));
  });
});
