import { DISCOVERY_CAPTURE_DEPTH } from '@asobeast/shared';

export interface DiscoveryReading {
  depth: number | null;
  ownSearch: boolean;
}

export const isCompleteReading = ({
  depth,
  ownSearch,
}: DiscoveryReading): boolean =>
  ownSearch || (depth !== null && depth < DISCOVERY_CAPTURE_DEPTH);
