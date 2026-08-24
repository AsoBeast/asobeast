import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { DigestService } from '../analytics/digest.service';
import { WorkspaceFanOut } from '../common/tenancy/workspace-fanout';
import { DigestDispatcher } from './digest.dispatcher';

const fanOut = {
  each: async <T>(_justification: string, work: () => Promise<T>) => ({
    results: [await work()],
    failures: [],
  }),
};

describe('DigestDispatcher', () => {
  let service: DigestDispatcher;
  const buildDigest = jest.fn();
  const dispatch = jest.fn();

  beforeEach(async () => {
    buildDigest.mockReset();
    dispatch.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [
        DigestDispatcher,
        { provide: DigestService, useValue: { buildDigest } },
        { provide: AlertsDispatcher, useValue: { dispatch } },
        { provide: ConfigService, useValue: { get: () => 2 } },
        { provide: WorkspaceFanOut, useValue: fanOut },
      ],
    }).compile();
    service = moduleRef.get(DigestDispatcher);
  });

  it('dispatches the built payload when the workspace has apps', async () => {
    const payload = { event: 'digest.weekly', apps: [{ id: 'app_1' }] };
    buildDigest.mockResolvedValue(payload);

    await service.run();

    expect(buildDigest).toHaveBeenCalledWith(2);
    expect(dispatch).toHaveBeenCalledWith(payload);
  });

  it('skips dispatch when the workspace has no apps', async () => {
    buildDigest.mockResolvedValue({ event: 'digest.weekly', apps: [] });

    await service.run();

    expect(dispatch).not.toHaveBeenCalled();
  });
});
