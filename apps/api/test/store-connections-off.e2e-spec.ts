import type { ApiErrorEnvelope } from '@asobeast/shared';
import { ownerAgent } from './helpers/session';
import {
  CONNECTION_REQUEST,
  startStoreConnectApp,
  type StoreConnectHarness,
} from './helpers/store-connect-harness';
import { obliterateQueues } from './obliterate-queues';

describe('Store connections without an encryption key (e2e)', () => {
  let harness: StoreConnectHarness;
  let owner: Awaited<ReturnType<typeof ownerAgent>>;

  beforeAll(async () => {
    harness = await startStoreConnectApp();
    owner = await ownerAgent(harness.app);
  }, 60_000);

  afterAll(async () => {
    await obliterateQueues(harness.app);
    await harness.app.close();
    await harness.prisma.$disconnect();
  });

  it('answers that store connections are unavailable', async () => {
    const response = await owner.get('/store-connections').expect(200);

    expect(response.body).toEqual({ available: false, connections: [] });
  });

  it('refuses a connection and names the variable, without calling apple', async () => {
    const response = await owner
      .put('/store-connections/APP_STORE')
      .send(CONNECTION_REQUEST)
      .expect(409);

    expect((response.body as ApiErrorEnvelope).message).toContain(
      'STORE_CONNECT_ENCRYPTION_KEY',
    );
    await owner.post('/store-connections/APP_STORE/sync').expect(409);
    await owner.post('/store-connections/APP_STORE/verify').expect(409);
    await owner.delete('/store-connections/APP_STORE').expect(409);
    expect(harness.asc.requests).toHaveLength(0);
  });
});
