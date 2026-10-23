import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UnknownStorefrontError } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_APP_ANNOTATIONS, AnnotationsService } from './annotations.service';
import { CreateAnnotationDto } from './dto/create-annotation.dto';

const ROW = {
  id: 'ann_1',
  appId: 'app_1',
  date: new Date('2026-10-08T00:00:00.000Z'),
  label: 'Release 5.21.0',
  market: 'de',
  tag: 'wave',
  createdAt: new Date('2026-10-08T09:00:00.000Z'),
};

const dto = (overrides: Partial<CreateAnnotationDto> = {}) => ({
  date: '2026-10-08',
  label: 'Release 5.21.0',
  ...overrides,
});

const build = (
  app: { id: string; store: 'APP_STORE' } | null = {
    id: 'app_1',
    store: 'APP_STORE',
  },
) => {
  const prisma = {
    app: {
      findFirst: jest.fn().mockResolvedValue(app),
    },
    appAnnotation: {
      create: jest.fn().mockResolvedValue(ROW),
      findMany: jest.fn().mockResolvedValue([ROW]),
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const service = new AnnotationsService(prisma as unknown as PrismaService);
  return { service, prisma };
};

describe('AnnotationsService', () => {
  it('stores an annotation with a UTC day and answers the item', async () => {
    const { service, prisma } = build();

    const item = await service.create(
      'app_1',
      dto({ market: 'de', tag: 'Wave' }),
    );

    expect(item).toEqual({
      id: 'ann_1',
      appId: 'app_1',
      date: '2026-10-08',
      label: 'Release 5.21.0',
      market: 'de',
      tag: 'wave',
      createdAt: '2026-10-08T09:00:00.000Z',
    });
    expect(prisma.appAnnotation.create).toHaveBeenCalledWith({
      data: {
        appId: 'app_1',
        date: new Date('2026-10-08T00:00:00.000Z'),
        label: 'Release 5.21.0',
        market: 'de',
        tag: 'Wave',
      },
    });
  });

  it('refuses an app it cannot see', async () => {
    const { service } = build(null);

    await expect(service.create('app_1', dto())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each(['xx', 'US'])(
    'refuses a market the store does not list: %s',
    async (market) => {
      const { service, prisma } = build();

      await expect(
        service.create('app_1', dto({ market })),
      ).rejects.toBeInstanceOf(UnknownStorefrontError);
      expect(prisma.appAnnotation.create).not.toHaveBeenCalled();
    },
  );

  it('refuses another annotation once the app holds the cap', async () => {
    const { service, prisma } = build();
    prisma.appAnnotation.count.mockResolvedValue(MAX_APP_ANNOTATIONS);

    await expect(service.create('app_1', dto())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.appAnnotation.create).not.toHaveBeenCalled();
  });

  it('lists the annotations of one app, oldest day first', async () => {
    const { service, prisma } = build();

    await service.list('app_1');

    expect(prisma.app.findFirst).toHaveBeenCalledWith({
      where: { id: 'app_1' },
      select: { id: true },
    });
    expect(prisma.appAnnotation.findMany).toHaveBeenCalledWith({
      where: { appId: 'app_1' },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  });

  it('answers 404 for an unknown app on list', async () => {
    const { service } = build(null);

    await expect(service.list('app_1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('removes an annotation of this app', async () => {
    const { service, prisma } = build();

    await service.remove('app_1', 'ann_1');

    expect(prisma.appAnnotation.deleteMany).toHaveBeenCalledWith({
      where: { id: 'ann_1', appId: 'app_1' },
    });
  });

  it('answers 404 when the delete removed nothing', async () => {
    const { service, prisma } = build();
    prisma.appAnnotation.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.remove('app_1', 'ann_1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
