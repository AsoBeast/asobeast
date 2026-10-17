import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { OnDemandLimiter } from '../auth/on-demand.limiter';
import { ChartFollowsService } from './chart-follows.service';
import { ChartReadService } from './chart-read.service';
import { ChartsController } from './charts.controller';

describe('ChartsController OpenAPI document', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ChartsController],
      providers: [
        { provide: ChartReadService, useValue: {} },
        { provide: ChartFollowsService, useValue: {} },
        { provide: OnDemandLimiter, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('declares both answers of a chart follow', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );

    const responses = document.paths['/charts/follows'].post?.responses ?? {};

    expect(Object.keys(responses).sort()).toEqual(['200', '201']);
    expect(responses['200']).toMatchObject({
      description: expect.stringContaining('already follows') as string,
    });
    expect(responses['201']).toMatchObject({
      description: expect.stringContaining('new follow') as string,
    });
  });
});
