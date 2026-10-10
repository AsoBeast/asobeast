import { accessSync, constants, statSync } from 'node:fs';

export function readable(path: string): boolean {
  try {
    accessSync(path, constants.R_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
