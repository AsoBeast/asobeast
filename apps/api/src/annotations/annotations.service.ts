import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppAnnotationItem,
  AppAnnotationList,
  assertStorefront,
} from '@asobeast/shared';
import { AppAnnotation } from '@prisma/client';
import { ensureAppExists } from '../apps/ensure-app';
import { PrismaService } from '../prisma/prisma.service';
import { toDateKey } from '../rankings/rankings.support';
import { CreateAnnotationDto } from './dto/create-annotation.dto';

export const MAX_APP_ANNOTATIONS = 100;

const ANNOTATION_LOCK = 9_105_367;

const toAnnotationItem = (annotation: AppAnnotation): AppAnnotationItem => ({
  id: annotation.id,
  appId: annotation.appId,
  date: toDateKey(annotation.date),
  label: annotation.label,
  market: annotation.market,
  tag: annotation.tag,
  createdAt: annotation.createdAt.toISOString(),
});

@Injectable()
export class AnnotationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    appId: string,
    dto: CreateAnnotationDto,
  ): Promise<AppAnnotationItem> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { id: true, store: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    if (dto.market !== undefined) {
      assertStorefront(app.store, dto.market);
    }

    return this.prisma.withTransaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ANNOTATION_LOCK}, hashtext(${app.id}))`;
      if (
        (await tx.appAnnotation.count({ where: { appId: app.id } })) >=
        MAX_APP_ANNOTATIONS
      ) {
        throw new ForbiddenException(
          `An app can have at most ${MAX_APP_ANNOTATIONS} annotations`,
        );
      }

      return toAnnotationItem(
        await tx.appAnnotation.create({
          data: {
            appId: app.id,
            date: new Date(`${dto.date}T00:00:00.000Z`),
            label: dto.label,
            market: dto.market,
            tag: dto.tag,
          },
        }),
      );
    });
  }

  async list(appId: string): Promise<AppAnnotationList> {
    await ensureAppExists(this.prisma, appId);
    const annotations = await this.prisma.appAnnotation.findMany({
      where: { appId },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return { annotations: annotations.map(toAnnotationItem) };
  }

  async remove(appId: string, annotationId: string): Promise<void> {
    const { count } = await this.prisma.appAnnotation.deleteMany({
      where: { id: annotationId, appId },
    });
    if (count === 0) {
      throw new NotFoundException(`Annotation ${annotationId} not found`);
    }
  }
}
