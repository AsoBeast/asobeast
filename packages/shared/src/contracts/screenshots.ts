import type { Store } from '../index';

export const SCREENSHOT_CAPTION_STATUSES = [
  'pending',
  'read',
  'blank',
  'failed',
  'skipped',
] as const;
export type ScreenshotCaptionStatus =
  (typeof SCREENSHOT_CAPTION_STATUSES)[number];

export const SCREENSHOT_READING_STATES = ['on', 'off', 'unsupported'] as const;
export type ScreenshotReadingState = (typeof SCREENSHOT_READING_STATES)[number];

export const SCREENSHOT_TEXT_STATES = [
  'ready',
  'reading',
  'empty',
  'off',
] as const;
export type ScreenshotTextStatus = (typeof SCREENSHOT_TEXT_STATES)[number];

export interface ScreenshotItem {
  position: number;
  url: string;
  caption: string | null;
  status: ScreenshotCaptionStatus;
}

export interface AppScreenshots {
  appId: string;
  store: Store;
  snapshotId: string | null;
  capturedAt: string | null;
  reading: ScreenshotReadingState;
  screenshots: ScreenshotItem[];
}

export interface ScreenshotTextState {
  status: ScreenshotTextStatus;
  read: number;
  total: number;
}

export interface ScreenshotTextCoverage {
  covered: boolean;
  positions: number[];
}
