import { createHash } from 'node:crypto';

const normalized = (text: string): string =>
  text.normalize('NFC').replace(/\s+/gu, ' ').trim();

export const descriptionFingerprint = (text: string): string =>
  createHash('sha256').update(normalized(text)).digest('hex');
