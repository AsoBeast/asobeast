export interface PopularityRow {
  country: string;
  term: string;
  week: string;
  genre: string;
  rankInGenre: number | null;
  popularity: number;
  popularityInGenre: number | null;
}

export abstract class ApplePopularityClient {
  abstract readonly enabled: boolean;
  abstract weekOf(country: string, week: string): Promise<PopularityRow[]>;
}

export class DisabledPopularityClient extends ApplePopularityClient {
  readonly enabled = false;

  weekOf(): Promise<PopularityRow[]> {
    return Promise.resolve([]);
  }
}
