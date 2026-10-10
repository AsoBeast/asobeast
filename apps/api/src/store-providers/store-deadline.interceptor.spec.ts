import {
  Controller,
  Get,
  INestApplication,
  UseInterceptors,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
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
});
