import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../auth.types';
import { SpendsStoreCapacity } from '../decorators/spends-store-capacity.decorator';
import { ReadOnlyEndpoint } from '../read-access';
import { TokenScopeGuard } from './token-scope.guard';

function contextFor(
  req: AuthenticatedRequest & { method: string },
  ...decorators: MethodDecorator[]
) {
  const handler = () => undefined;
  for (const decorate of decorators) {
    (decorate as (target: unknown) => void)(handler);
  }
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

describe('TokenScopeGuard', () => {
  const guard = new TokenScopeGuard(new Reflector());

  it('lets a session change anything', () => {
    expect(guard.canActivate(contextFor({ method: 'POST' }))).toBe(true);
  });

  it('lets a read-only token read', () => {
    expect(
      guard.canActivate(contextFor({ method: 'GET', tokenScope: 'read' })),
    ).toBe(true);
  });

  it('refuses a write from a read-only token', () => {
    expect(() =>
      guard.canActivate(contextFor({ method: 'POST', tokenScope: 'read' })),
    ).toThrow(ForbiddenException);
  });

  it('lets a write-scoped token write', () => {
    expect(
      guard.canActivate(contextFor({ method: 'DELETE', tokenScope: 'write' })),
    ).toBe(true);
  });

  it('lets a read-only token reach a lookup that spends store capacity', () => {
    expect(
      guard.canActivate(
        contextFor(
          { method: 'GET', tokenScope: 'read' },
          SpendsStoreCapacity(),
        ),
      ),
    ).toBe(true);
  });

  it('lets a read-only token reach a read-only endpoint served over POST', () => {
    expect(
      guard.canActivate(
        contextFor({ method: 'POST', tokenScope: 'read' }, ReadOnlyEndpoint()),
      ),
    ).toBe(true);
  });
});
