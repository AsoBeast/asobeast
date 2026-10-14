import type { PrismaService } from '../prisma/prisma.service';
import {
  type AppLocalizationRecord,
  recordAppLocalizations,
} from './app-localization-records';

const clientWith = (count: number) => {
  const createMany = jest.fn().mockResolvedValue({ count });
  return {
    client: { appLocalization: { createMany } } as unknown as PrismaService,
    createMany,
  };
};

const row = (localization: string): AppLocalizationRecord => ({
  appId: 'app1',
  workspaceId: 'ws1',
  localization,
  origin: 'manual',
});

describe('recordAppLocalizations', () => {
  it('creates the rows skipping duplicates and answers the inserted count', async () => {
    const { client, createMany } = clientWith(1);
    const rows = [row('es-MX'), row('fr')];

    await expect(recordAppLocalizations(client, rows)).resolves.toBe(1);
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledWith({
      data: rows,
      skipDuplicates: true,
    });
  });

  it('writes nothing for an empty list', async () => {
    const { client, createMany } = clientWith(0);

    await expect(recordAppLocalizations(client, [])).resolves.toBe(0);
    expect(createMany).not.toHaveBeenCalled();
  });
});
