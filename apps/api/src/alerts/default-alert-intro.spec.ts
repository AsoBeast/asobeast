import type { PrismaService } from '../prisma/prisma.service';
import { DefaultAlertIntro } from './default-alert-intro';

const build = (count: number) => {
  const updateMany = jest.fn().mockResolvedValue({ count });
  return {
    intro: new DefaultAlertIntro({
      emailAlert: { updateMany },
    } as unknown as PrismaService),
    updateMany,
  };
};

describe('DefaultAlertIntro', () => {
  const now = new Date('2026-11-04T05:00:00.000Z');

  it('claims the sentence once for an essential alert', async () => {
    const { intro, updateMany } = build(1);

    await expect(intro.claim('ea_1', now)).resolves.toEqual(now);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'ea_1', defaultOrigin: true, introSentAt: null },
      data: { introSentAt: now },
    });
  });

  it('answers null when the sentence was already sent', async () => {
    const { intro } = build(0);

    await expect(intro.claim('ea_1', now)).resolves.toBeNull();
  });

  it('gives back only its own claim', async () => {
    const { intro, updateMany } = build(1);

    await intro.restore('ea_1', now);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'ea_1', introSentAt: now },
      data: { introSentAt: null },
    });
  });
});
