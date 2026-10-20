import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { clearRateLimitCounters } from '../obliterate-queues';

export const OWNER = {
  email: 'owner@example.com',
  password: 'supersecret1',
};

export function useCookies(app: INestApplication<App>): void {
  app.use(cookieParser());
}

export async function ownerAgent(app: INestApplication<App>) {
  await clearRateLimitCounters(app);
  const agent = request.agent(app.getHttpServer());
  const login = await agent.post('/auth/login').send(OWNER);
  if (login.status === 200) return agent;
  await agent.post('/auth/register').send(OWNER).expect(201);
  return agent;
}

export function sessionCookieOf(response: request.Response): string {
  const raw = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((entry) => entry.startsWith('asobeast_session='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie.split(';')[0];
}
