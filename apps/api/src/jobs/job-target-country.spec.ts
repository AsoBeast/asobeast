import { Store } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { jobStore, JobTargetCountry } from './job-target-country';
import { JOBS, QUEUES } from './jobs.types';

describe('JobTargetCountry', () => {
  const findFirst = jest.fn();
  const findUnique = jest.fn();
  const prisma = {
    app: { findFirst },
    keyword: { findUnique },
  } as unknown as PrismaService;
  const target = new JobTargetCountry(prisma);

  const job = (name: string, data: unknown): Job =>
    ({ name, data, queueName: QUEUES.APP_STORE }) as Job;

  beforeEach(() => {
    findFirst.mockReset().mockResolvedValue({ country: 'de' });
    findUnique.mockReset().mockResolvedValue({ country: 'jp' });
  });

  it('reads the storefront a category job already carries', async () => {
    await expect(
      target.of(job(JOBS.CHECK_CATEGORY, { country: 'fr' })),
    ).resolves.toBe('fr');

    expect(findFirst).not.toHaveBeenCalled();
  });

  it('takes the home storefront of the app a refresh targets', async () => {
    await expect(
      target.of(job(JOBS.REFRESH_APP, { appId: 'a1' })),
    ).resolves.toBe('de');
  });

  it('takes the market of the keyword a rank check targets', async () => {
    await expect(
      target.of(job(JOBS.CHECK_KEYWORD, { keywordId: 'k1' })),
    ).resolves.toBe('jp');
  });

  it('reports no storefront when the row is gone', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      target.of(job(JOBS.SCORE_KEYWORD, { keywordId: 'k1' })),
    ).resolves.toBeUndefined();
  });

  it('reports no storefront for a job that touches no single market', async () => {
    await expect(target.of(job('unknown-job', {}))).resolves.toBeUndefined();
  });

  it('maps each queue onto the store it serves', () => {
    expect(jobStore({ queueName: QUEUES.GPLAY } as Job)).toBe(
      Store.GOOGLE_PLAY,
    );
    expect(jobStore({ queueName: QUEUES.APP_STORE } as Job)).toBe(
      Store.APP_STORE,
    );
  });
});
