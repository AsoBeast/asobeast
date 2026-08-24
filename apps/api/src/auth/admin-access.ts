import { HttpStatus, type INestApplication } from '@nestjs/common';
import type { Request, RequestHandler, Response } from 'express';
import {
  ApiErrorEnvelope,
  SESSION_COOKIE,
  type RateClass,
} from '@asobeast/shared';
import { refusesWhileSuspended } from './abuse/suspension';
import { isPlatformOperator } from './platform-operator';
import { READ_METHODS } from './read-access';
import { AuthService } from './auth.service';

export const ADMIN_QUEUES_ROUTE = '/admin/queues';
export const METRICS_ROUTE = '/metrics';
export const SUPPORT_ROUTE = '/admin/support';
export const DOCS_ROUTE = '/docs';
export const DOCS_ROUTES = [
  DOCS_ROUTE,
  `${DOCS_ROUTE}-json`,
  `${DOCS_ROUTE}-yaml`,
];

export interface AdminSurface {
  path: string;
  rateClass: RateClass;
}

export const ADMIN_QUEUES_SURFACE: AdminSurface = {
  path: ADMIN_QUEUES_ROUTE,
  rateClass: 'write',
};

export const METRICS_SURFACE: AdminSurface = {
  path: METRICS_ROUTE,
  rateClass: 'read',
};

export const SUPPORT_SURFACE: AdminSurface = {
  path: SUPPORT_ROUTE,
  rateClass: 'write',
};

export const DOCS_SURFACES: AdminSurface[] = DOCS_ROUTES.map((path) => ({
  path,
  rateClass: 'read',
}));

const granted = new WeakSet<object>();

function harden(res: Response): void {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
}

function deny(req: Request, res: Response): void {
  const envelope: ApiErrorEnvelope = {
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.baseUrl}${req.path}`,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  };
  res.status(envelope.statusCode).json(envelope);
}

export const requireAdminAccess: RequestHandler = (req, res, next) => {
  harden(res);
  if (granted.has(req)) {
    next();
    return;
  }
  deny(req, res);
};

function grantAdminAccess(
  app: INestApplication,
  surface: AdminSurface,
): RequestHandler {
  return (req, res, next) => {
    harden(res);
    const auth = app.get(AuthService, { strict: false });
    const cookies = req.cookies as Record<string, string> | undefined;
    void (async () => {
      const session = await auth.resolveSessionUser(cookies?.[SESSION_COOKIE]);
      const token = session
        ? null
        : await auth.resolveToken(req.headers.authorization);
      const user = session ?? token?.user;
      if (!user || !isPlatformOperator(user) || !auth.entitled(user)) {
        deny(req, res);
        return;
      }
      if (token?.scope === 'read' && !READ_METHODS.includes(req.method)) {
        deny(req, res);
        return;
      }
      if (
        refusesWhileSuspended(user.workspace, {
          credential: session ? 'session' : 'token',
          rateClass: surface.rateClass,
          allowedWhileUnentitled: false,
        })
      ) {
        deny(req, res);
        return;
      }
      granted.add(req);
      next();
    })().catch(() => deny(req, res));
  };
}

export function configureAdminAccess(
  app: INestApplication,
  surfaces: readonly AdminSurface[],
): void {
  for (const surface of surfaces) {
    app.use(surface.path, grantAdminAccess(app, surface));
  }
}
