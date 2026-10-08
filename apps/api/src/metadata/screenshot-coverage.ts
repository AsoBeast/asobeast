import type {
  ScreenshotReadingState,
  ScreenshotTextCoverage,
  ScreenshotTextState,
} from '@asobeast/shared';
import { coversKeyword } from '../keywords/keyword-coverage';

interface Captioned {
  position: number;
  status: string;
  caption: string | null;
}

export function screenshotTextCoverage(
  screenshots: readonly Captioned[],
  keyword: string,
): ScreenshotTextCoverage {
  const positions = screenshots
    .filter(
      (screenshot) =>
        screenshot.caption !== null &&
        coversKeyword(screenshot.caption, keyword),
    )
    .map((screenshot) => screenshot.position);
  return { covered: positions.length > 0, positions };
}

export function screenshotTextState(
  screenshots: readonly Captioned[],
  reading: ScreenshotReadingState,
): ScreenshotTextState | null {
  if (reading === 'unsupported') return null;
  const total = screenshots.length;
  const read = screenshots.filter((item) => item.caption !== null).length;
  if (reading === 'off') return { status: 'off', read: 0, total };
  if (screenshots.some((item) => item.status === 'pending')) {
    return { status: 'reading', read, total };
  }
  return { status: read === 0 ? 'empty' : 'ready', read, total };
}
