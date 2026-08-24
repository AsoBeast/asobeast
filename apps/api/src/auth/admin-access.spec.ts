import type { INestApplication } from '@nestjs/common';
import type { Request, RequestHandler, Response } from 'express';
import type { ApiTokenScope } from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/tenancy/default-workspace';
import {
  ADMIN_QUEUES_SURFACE,
  METRICS_SURFACE,
  configureAdminAccess,
  requireAdminAccess,
} from './admin-access';
import type { AccountUser } from './auth.types';

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

function gateFor(
  surface: Parameters<typeof configureAdminAccess>[1][number],
  scope: ApiTokenScope,
): RequestHandler {
  const handlers: RequestHandler[] = [];
  const auth = {
    resolveSessionUser: () => Promise.resolve(null),
    resolveToken: () => Promise.resolve({ user: operator, scope }),
    entitled: () => true,
  };
  const app = {
    get: () => auth,
    use: (_path: string, handler: RequestHandler) => handlers.push(handler),
  } as unknown as INestApplication;

  configureAdminAccess(app, [surface]);
  return handlers[0];
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

describe('admin surface token scope', () => {
  const settle = () => new Promise((resolve) => setImmediate(resolve));

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'denies a read-only token the %s that changes queue state',
    async (method) => {
      const res = fakeResponse();
      const next = jest.fn();

      gateFor(ADMIN_QUEUES_SURFACE, 'read')(
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

    gateFor(ADMIN_QUEUES_SURFACE, 'read')(
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

    gateFor(ADMIN_QUEUES_SURFACE, 'write')(
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

    gateFor(METRICS_SURFACE, 'read')(
      requestFor('GET'),
      res as unknown as Response,
      next,
    );
    await settle();

    expect(next).toHaveBeenCalled();
  });
});
