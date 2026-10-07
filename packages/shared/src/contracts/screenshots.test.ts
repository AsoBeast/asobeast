import { describe, expect, it } from 'vitest';
import {
  SCREENSHOT_CAPTION_STATUSES,
  SCREENSHOT_READING_STATES,
  SCREENSHOT_TEXT_STATES,
} from './screenshots';

describe('the screenshot caption contract', () => {
  it('names the five states of one screenshot in the order a read moves through them', () => {
    expect(SCREENSHOT_CAPTION_STATUSES).toEqual([
      'pending',
      'read',
      'blank',
      'failed',
      'skipped',
    ]);
  });

  it('names the three ways an app can be read', () => {
    expect(SCREENSHOT_READING_STATES).toEqual(['on', 'off', 'unsupported']);
  });

  it('names the four states of the screenshot text surface in coverage', () => {
    expect(SCREENSHOT_TEXT_STATES).toEqual([
      'ready',
      'reading',
      'empty',
      'off',
    ]);
  });
});
