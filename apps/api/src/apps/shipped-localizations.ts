import { PrismaService } from '../prisma/prisma.service';

export async function shippedLocalizations(
  prisma: PrismaService,
  appId: string,
): Promise<string[]> {
  const rows = await prisma.appLocalization.findMany({
    where: { appId },
    select: { localization: true },
  });
  return rows.map(({ localization }) => localization);
}
