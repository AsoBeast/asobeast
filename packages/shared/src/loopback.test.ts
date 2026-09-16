import { describe, expect, it } from 'vitest';
import { isLoopbackHostname } from './loopback';

describe('isLoopbackHostname', () => {
  it.each(['localhost', '127.0.0.1', '[::1]', 'asobeast.localhost'])(
    'treats %s as this machine',
    (hostname) => {
      expect(isLoopbackHostname(hostname)).toBe(true);
    },
  );

  it.each(['app.asobeast.com', '192.168.1.10', 'api', 'localhost.example.com'])(
    'treats %s as another machine',
    (hostname) => {
      expect(isLoopbackHostname(hostname)).toBe(false);
    },
  );
});
