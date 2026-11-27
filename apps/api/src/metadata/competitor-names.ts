import { PrismaService } from '../prisma/prisma.service';

export async function competitorNames(
  prisma: PrismaService,
  appId: string,
): Promise<string[]> {
  const competitors = await prisma.app.findMany({
    where: { primaryAppId: appId },
    select: { name: true },
  });
  return competitors
    .map((competitor) => competitor.name)
    .filter((name): name is string => Boolean(name));
}
