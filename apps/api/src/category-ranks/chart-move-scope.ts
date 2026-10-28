import {
  chartGenreName,
  type ChartKey,
  type ChartMoveScope,
} from '@asobeast/shared';

export function chartMoveScope(key: ChartKey): ChartMoveScope {
  return {
    store: key.store,
    country: key.country,
    collection: key.collection,
    genre: key.genre,
    genreName: chartGenreName(key.store, key.genre) ?? key.genre,
    device: key.device,
  };
}
