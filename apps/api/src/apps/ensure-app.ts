import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export async function ensureAppExists(
  prisma: PrismaService,
  appId: string,
): Promise<void> {
  const app = await prisma.app.findFirst({
    where: { id: appId },
    select: { id: true },
  });
  if (!app) {
    throw new NotFoundException(`App ${appId} not found`);
  }
}
