import type { INestApplication } from '@nestjs/common';
import type { Request, RequestHandler, Response } from 'express';
import type { ApiTokenScope } from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/tenancy/default-workspace';
import {
  ADMIN_AREA_SURFACE,
  ADMIN_QUEUES_SURFACE,
  METRICS_SURFACE,
  SUPPORT_SURFACE,
  configureAdminAccess,
  requireAdminAccess,
} from './admin-access';
import { AuthService } from './auth.service';
import type { AccountUser } from './auth.types';
import { CredentialResolver } from './credential-resolver';
import { CredentialRateLimitError } from './rate-limit/rate-limit.errors';

function fakeResponse() {
  const res = {
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('requireAdminAccess', () => {
  it('denies a request the gate never granted', () => {
    const req = {
      method: 'GET',
      baseUrl: '/admin/queues',
      path: '/',
      originalUrl: '/admin/queues',
      headers: {},
    };
    const res = fakeResponse();
    const next = jest.fn();

    requireAdminAccess(
      req as unknown as Request,
      res as unknown as Response,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, error: 'Not Found' }),
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Robots-Tag',
      'noindex, nofollow',
    );
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});

const operator = {
  role: 'owner',
  workspaceId: DEFAULT_WORKSPACE_ID,
  workspace: { suspendedAt: null },
} as unknown as AccountUser;

function operatorToken(scope: ApiTokenScope): CredentialResolver['resolve'] {
  return () =>
    Promise.resolve({ user: operator, credential: 'token', tokenScope: scope });
}

function gateFor(
  surface: Parameters<typeof configureAdminAccess>[1][number],
  resolve: CredentialResolver['resolve'],
  entitled = true,
): RequestHandler {
  const handlers: RequestHandler[] = [];
  const providers = new Map<unknown, unknown>([
    [AuthService, { entitled: () => entitled }],
    [CredentialResolver, { resolve }],
  ]);
  const app = {
    get: (type: unknown) => providers.get(type),
    use: (_path: string, handler: RequestHandler) => handlers.push(handler),
  } as unknown as INestApplication;

  configureAdminAccess(app, [surface]);
  return handlers[0];
}

function requestAt(path: string, method: string) {
  return {
    method,
    baseUrl: path,
    path: '/',
    originalUrl: path,
    headers: { authorization: 'Bearer asob_x' },
  } as unknown as Request;
}

function requestFor(method: string) {
  return {
    method,
    baseUrl: '/admin/queues',
    path: '/',
    originalUrl: '/admin/queues',
    headers: { authorization: 'Bearer asob_x' },
  } as unknown as Request;
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('admin surface token scope', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'denies a read-only token the %s that changes queue state',
    async (method) => {
      const res = fakeResponse();
      const next = jest.fn();

      gateFor(ADMIN_QUEUES_SURFACE, operatorToken('read'))(
        requestFor(method),
        res as unknown as Response,
        next,
      );
      await settle();

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
    },
  );

  it('lets a read-only token read the queue dashboard', async () => {
    const res = fakeResponse();
    const next = jest.fn();

    gateFor(ADMIN_QUEUES_SURFACE, operatorToken('read'))(
      requestFor('GET'),
      res as unknown as Response,
      next,
    );
    await settle();

    expect(next).toHaveBeenCalled();
  });

  it('lets a write token change queue state', async () => {
    const res = fakeResponse();
    const next = jest.fn();

    gateFor(ADMIN_QUEUES_SURFACE, operatorToken('write'))(
      requestFor('POST'),
      res as unknown as Response,
      next,
    );
    await settle();

    expect(next).toHaveBeenCalled();
  });

  it('leaves a read-only token free on a read-only surface', async () => {
    const res = fakeResponse();
    const next = jest.fn();

    gateFor(METRICS_SURFACE, operatorToken('read'))(
      requestFor('GET'),
      res as unknown as Response,
      next,
    );
    await settle();

    expect(next).toHaveBeenCalled();
  });
});

describe('admin surface rejected credentials', () => {
  it('answers a spent rejection budget with not found', async () => {
    const res = fakeResponse();
    const next = jest.fn();

    gateFor(METRICS_SURFACE, () =>
      Promise.reject(new CredentialRateLimitError(30)),
    )(requestFor('GET'), res as unknown as Response, next);
    await settle();

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('admin area gate', () => {
  const anonymous: CredentialResolver['resolve'] = () => Promise.resolve(null);

  it.each(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])(
    'answers an anonymous %s with not found',
    async (method) => {
      const res = fakeResponse();
      const next = jest.fn();

      gateFor(ADMIN_AREA_SURFACE, anonymous)(
        requestAt('/admin/capacity', method),
        res as unknown as Response,
        next,
      );
      await settle();

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
    },
  );

  it('lets an operator without a plan into the area but not into the queue dashboard', async () => {
    const resolve = operatorToken('read');
    const area = fakeResponse();
    const areaNext = jest.fn();
    const queues = fakeResponse();
    const queuesNext = jest.fn();

    gateFor(ADMIN_AREA_SURFACE, resolve, false)(
      requestAt('/admin/capacity', 'GET'),
      area as unknown as Response,
      areaNext,
    );
    gateFor(ADMIN_QUEUES_SURFACE, resolve, false)(
      requestAt('/admin/queues', 'GET'),
      queues as unknown as Response,
      queuesNext,
    );
    await settle();

    expect(areaNext).toHaveBeenCalled();
    expect(queuesNext).not.toHaveBeenCalled();
    expect(queues.status).toHaveBeenCalledWith(404);
  });

  it('denies a read token a method that changes state', async () => {
    const res = fakeResponse();
    const next = jest.fn();

    gateFor(ADMIN_AREA_SURFACE, operatorToken('read'))(
      requestAt('/admin/capacity', 'POST'),
      res as unknown as Response,
      next,
    );
    await settle();

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('resolves the credential once for a request an earlier surface granted', async () => {
    const resolve = jest.fn(operatorToken('write'));
    const req = requestAt('/admin/support/workspaces', 'GET');
    const next = jest.fn();

    gateFor(SUPPORT_SURFACE, resolve)(
      req,
      fakeResponse() as unknown as Response,
      next,
    );
    await settle();
    gateFor(ADMIN_AREA_SURFACE, resolve)(
      req,
      fakeResponse() as unknown as Response,
      next,
    );
    await settle();

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
