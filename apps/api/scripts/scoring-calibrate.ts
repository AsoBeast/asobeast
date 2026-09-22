import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CrossTenantAccess } from '../src/common/tenancy/cross-tenant-access';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  CalibrationRow,
  calibrationPairs,
  calibrationReport,
} from '../src/scoring/calibration';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  try {
    const prisma = app.get(PrismaService);
    const keywords = await app
      .get(CrossTenantAccess)
      .becauseThisWorkIsNotOwnedByOneWorkspace(
        'the calibration report compares every scored app store keyword',
        () =>
          prisma.keyword.findMany({
            where: { store: 'APP_STORE' },
            select: {
              text: true,
              metrics: {
                orderBy: { date: 'desc' },
                take: 1,
                select: { formulaVersion: true, stats: true },
              },
            },
          }),
      );
    const rows: CalibrationRow[] = keywords.flatMap(({ text, metrics }) =>
      metrics.map((metric) => ({ text, ...metric })),
    );
    const report = calibrationReport(calibrationPairs(rows));
    if (report.status === 'not_enough_data') {
      console.log(
        `not enough data: ${report.pairs} keywords carry both an estimate and an Apple value`,
      );
      return;
    }
    console.table({
      pairs: report.pairs,
      spearman: Number(report.spearman.toFixed(3)),
      meanAbsoluteError: Number(report.meanAbsoluteError.toFixed(1)),
      meanSignedError: Number(report.meanSignedError.toFixed(1)),
    });
    console.table(
      report.largest.map((pair) => ({
        keyword: pair.keyword,
        estimated: Math.round(pair.estimated * 10),
        official: pair.official,
        error: Math.round(pair.error),
        reach: pair.reach,
        flags: pair.flags.join(' '),
      })),
    );
  } finally {
    await app.close();
  }
}

void main();
