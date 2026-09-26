import { Store } from '../index';

export const CURRENT_FORMULA_VERSIONS: Record<Store, string> = {
  APP_STORE: 'app-store-v2',
  GOOGLE_PLAY: 'google-play-v3',
};

const SCORE_DISPLAY_MAX = 100;

function toDisplayScale(score: number): number {
  return Math.min(SCORE_DISPLAY_MAX, Math.max(0, score * 10));
}

export function toVolume(traffic: number): number {
  return toDisplayScale(traffic);
}

export function toDifficulty100(difficulty: number): number {
  return toDisplayScale(difficulty);
}
