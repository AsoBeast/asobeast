import {
  Controller,
  Get,
  INestApplication,
  UseInterceptors,
} from '@nestjs/common';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppsController } from '../apps/apps.controller';
import { CompetitorsController } from '../competitors/competitors.controller';
import { KeywordsController } from '../keywords/keywords.controller';
import { storeDeadline } from './store-deadline';
import { StoreDeadlineInterceptor } from './store-deadline.interceptor';

const deadlineAfterAnAwait = async () => {
  await new Promise((resolve) => setTimeout(resolve, 1));
  return { bounded: storeDeadline().signal instanceof AbortSignal };
};

@Controller('probe')
class ProbeController {
  @Get('bounded')
  @UseInterceptors(StoreDeadlineInterceptor)
  bounded() {
    return deadlineAfterAnAwait();
  }

  @Get('unbounded')
  unbounded() {
    return deadlineAfterAnAwait();
  }
}

describe('StoreDeadlineInterceptor', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(() => app.close());

  it('runs a decorated handler inside an on demand store deadline', async () => {
    const response = await request(app.getHttpServer()).get('/probe/bounded');

    expect(response.body).toEqual({ bounded: true });
  });

  it('leaves every other handler without a deadline', async () => {
    const response = await request(app.getHttpServer()).get('/probe/unbounded');

    expect(response.body).toEqual({ bounded: false });
  });

  it.each([
    ['POST /apps', AppsController, 'import'],
    ['POST /apps/{id}/refresh', AppsController, 'refresh'],
    [
      'GET /apps/{id}/market-availability',
      AppsController,
      'marketAvailability',
    ],
    ['POST /apps/{id}/competitors', CompetitorsController, 'add'],
    ['GET /apps/{id}/keywords/suggestions', KeywordsController, 'suggestions'],
  ])(
    'bounds %s, which waits on a store, by the deadline',
    (_route, controller: { prototype: object }, handler) => {
      const method = Object.getOwnPropertyDescriptor(
        controller.prototype,
        handler,
      )?.value as object;

      expect(Reflect.getMetadata(INTERCEPTORS_METADATA, method)).toContain(
        StoreDeadlineInterceptor,
      );
    },
  );
});
