import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function apiVersion(): string {
  const { version } = JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
  ) as { version: string };
  return version;
}
