import { PrismaService } from '../prisma/prisma.service';
import { appMarkets } from './localization-markets';

export async function loadAppMarkets(
  client: PrismaService,
  app: { id: string; country: string },
): Promise<string[]> {
  const rows = await client.keyword.findMany({
    where: { tracked: { some: { appId: app.id } } },
    distinct: ['country'],
    select: { country: true },
  });
  return appMarkets(
    app.country,
    rows.map(({ country }) => country),
  );
}
