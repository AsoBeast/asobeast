import type { PrismaClient } from '@prisma/client';
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
