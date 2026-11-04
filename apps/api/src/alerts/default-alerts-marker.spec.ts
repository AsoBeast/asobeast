import type { WorkspaceContext } from '../common/tenancy/workspace-context';
import { DefaultAlertsMarker } from './default-alerts-marker';

describe('DefaultAlertsMarker', () => {
  const now = new Date('2026-11-04T05:00:00.000Z');
  const build = () => {
    const updateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const require = jest.fn(() => 'ws_1');
    const marker = new DefaultAlertsMarker({
      require,
    } as unknown as WorkspaceContext);
    return { marker, updateMany, db: { workspace: { updateMany } } };
  };

  it('settles the marker of the current workspace once', async () => {
    const { marker, updateMany, db } = build();

    await expect(marker.claim(db, now)).resolves.toBe(true);
    await expect(marker.claim(db, now)).resolves.toBe(false);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'ws_1', defaultAlertsAt: null },
      data: { defaultAlertsAt: now },
    });
  });
});
