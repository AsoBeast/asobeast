import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type { ApiTokenCreated, ApiTokenScope } from '@asobeast/shared';
import request, { type Response } from 'supertest';
import type { App } from 'supertest/types';
import { sha256 } from '../../src/auth/password-hash';

export interface TokenHolder {
  seed: string;
  email: string;
  workspaceId: string;
  role: string;
  scope?: string;
}

export function truncateUsers(prisma: PrismaClient): Promise<number> {
  return prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
  );
}

export async function seedWorkspace(
  prisma: PrismaClient,
  id: string,
  name: string,
): Promise<void> {
  await prisma.workspace.upsert({
    where: { id },
    update: {},
    create: { id, name },
  });
}

export async function seedApiToken(
  prisma: PrismaClient,
  holder: TokenHolder,
): Promise<string> {
  const plaintext = `asob_${holder.seed.padEnd(48, '0')}`;
  const scope = holder.scope ?? 'read';
  const user = await prisma.user.upsert({
    where: { email: holder.email },
    update: { role: holder.role, workspaceId: holder.workspaceId },
    create: {
      workspaceId: holder.workspaceId,
      email: holder.email,
      passwordHash: 'password-login-unused',
      role: holder.role,
    },
  });
  await prisma.apiToken.upsert({
    where: { tokenHash: sha256(plaintext) },
    update: { scope },
    create: {
      userId: user.id,
      name: 'e2e',
      tokenHash: sha256(plaintext),
      prefix: plaintext.slice(0, 12),
      scope,
    },
  });
  return plaintext;
}

function sessionOf(signedIn: Response): string {
  const raw = signedIn.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((entry) => entry.startsWith('asobeast_session='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie.split(';')[0];
}

export async function mintApiToken(
  app: INestApplication<App>,
  signedIn: Response,
  scope: ApiTokenScope,
): Promise<string> {
  const created = await request(app.getHttpServer())
    .post('/auth/tokens')
    .set('Cookie', sessionOf(signedIn))
    .send({ name: `e2e ${scope}`, scope })
    .expect(201);
  return (created.body as ApiTokenCreated).token;
}
