import { DISCOVERY_CAPTURE_DEPTH } from '@asobeast/shared';
import { DiscoveryReading, isCompleteReading } from './discovery-reading';

describe('isCompleteReading', () => {
  it.each<[string, DiscoveryReading, boolean]>([
    ['an own search of a short list', { ownSearch: true, depth: 30 }, true],
    ['an own search to the rank depth', { ownSearch: true, depth: 200 }, true],
    [
      'an own search that listed exactly the capture depth',
      { ownSearch: true, depth: DISCOVERY_CAPTURE_DEPTH },
      true,
    ],
    [
      'a capture that held the whole list',
      { ownSearch: false, depth: 26 },
      true,
    ],
    [
      'a capture cut at the capture depth',
      { ownSearch: false, depth: DISCOVERY_CAPTURE_DEPTH },
      false,
    ],
    ['a row never read', { ownSearch: false, depth: null }, false],
  ])('judges %s', (_, reading, complete) => {
    expect(isCompleteReading(reading)).toBe(complete);
  });
});
