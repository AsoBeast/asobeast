import { describe, expect, it } from 'vitest';

import { QUERY_BOUNDS } from './query-bounds';

describe('QUERY_BOUNDS', () => {
  it('lets one bulk change cover every listed action', () => {
    expect(QUERY_BOUNDS.actionBulkIds.max).toBeGreaterThanOrEqual(
      QUERY_BOUNDS.actionsLimit.max,
    );
  });
});
