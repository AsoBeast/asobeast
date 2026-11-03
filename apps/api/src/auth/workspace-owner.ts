import type { PrismaService } from '../prisma/prisma.service';

export async function workspaceOwnerEmail(
  prisma: Pick<PrismaService, 'user'>,
  workspaceId: string,
): Promise<string | null> {
  const owner = await prisma.user.findFirst({
    where: { workspaceId, role: 'owner' },
    orderBy: { createdAt: 'asc' },
    select: { email: true },
  });
  return owner?.email ?? null;
}
