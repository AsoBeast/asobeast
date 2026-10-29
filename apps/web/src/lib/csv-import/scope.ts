import type { Store } from "@asobeast/shared";
import { headerKey } from "./columns";
import type { CsvRecord } from "./tokenize";

export interface ImportTarget {
  store: Store;
  storeAppId: string;
  name: string | null;
}

export interface AppChoice {
  value: string;
  label: string;
  rows: number;
}

export interface FileScope {
  appColumn: number | null;
  platformColumn: number | null;
  apps: AppChoice[];
  usedColumns: number;
}

export interface LeftOut {
  otherApps: number;
  otherStore: number;
}

export interface ScopedRecords extends LeftOut {
  records: CsvRecord[];
}

export const NO_SCOPE: FileScope = {
  appColumn: null,
  platformColumn: null,
  apps: [],
  usedColumns: 0,
};

const APP_ID_KEYS: ReadonlySet<string> = new Set([
  "appid",
  "storeappid",
  "packagename",
]);
const APP_NAME_KEYS: ReadonlySet<string> = new Set([
  "appname",
  "app",
  "application",
]);
const PLATFORM_KEYS: ReadonlySet<string> = new Set([
  "platform",
  "store",
  "os",
  "operatingsystem",
]);

const STORE_OF_PLATFORM: ReadonlyMap<string, Store> = new Map([
  ["ios", "APP_STORE"],
  ["iphone", "APP_STORE"],
  ["ipad", "APP_STORE"],
  ["mac", "APP_STORE"],
  ["macos", "APP_STORE"],
  ["appstore", "APP_STORE"],
  ["apple", "APP_STORE"],
  ["android", "GOOGLE_PLAY"],
  ["googleplay", "GOOGLE_PLAY"],
  ["googleplaystore", "GOOGLE_PLAY"],
  ["playstore", "GOOGLE_PLAY"],
  ["play", "GOOGLE_PLAY"],
]);

const storeOfPlatform = (cell: string): Store | undefined =>
  STORE_OF_PLATFORM.get(headerKey(cell));

const cellOf = (record: CsvRecord, column: number): string =>
  (record.cells[column] ?? "").trim();

function firstColumn(
  keys: readonly string[],
  names: ReadonlySet<string>,
): number | null {
  const index = keys.findIndex((key) => names.has(key));
  return index >= 0 ? index : null;
}

function namesPlatforms(data: readonly CsvRecord[], column: number): boolean {
  const cells = data.map((record) => cellOf(record, column)).filter(Boolean);
  return cells.length > 0 && cells.every((cell) => storeOfPlatform(cell));
}

function platformColumnOf(
  keys: readonly string[],
  data: readonly CsvRecord[],
): number | null {
  const index = keys.findIndex(
    (key, column) => PLATFORM_KEYS.has(key) && namesPlatforms(data, column),
  );
  return index >= 0 ? index : null;
}

function appChoices(
  data: readonly CsvRecord[],
  appColumn: number,
  nameColumn: number | null,
): AppChoice[] {
  const choices = new Map<string, AppChoice>();
  for (const record of data) {
    const cell = cellOf(record, appColumn);
    const value = headerKey(cell);
    if (value === "") continue;
    const name = nameColumn === null ? "" : cellOf(record, nameColumn);
    const known = choices.get(value);
    if (known) {
      known.rows += 1;
      if (known.label === cell && name !== "") known.label = name;
    } else {
      choices.set(value, { value, label: name || cell, rows: 1 });
    }
  }
  return [...choices.values()];
}

export function scopeOf(
  header: readonly string[],
  data: readonly CsvRecord[],
): FileScope {
  const keys = header.map(headerKey);
  const idColumn = firstColumn(keys, APP_ID_KEYS);
  const nameColumn = firstColumn(keys, APP_NAME_KEYS);
  const appColumn = idColumn ?? nameColumn;
  const platformColumn = platformColumnOf(keys, data);
  const apps =
    appColumn === null
      ? []
      : appChoices(data, appColumn, idColumn === null ? null : nameColumn);
  const used = new Set<number>();
  if (apps.length > 1) {
    for (const column of [idColumn, nameColumn]) {
      if (column !== null) used.add(column);
    }
  }
  if (platformColumn !== null) used.add(platformColumn);
  return { appColumn, platformColumn, apps, usedColumns: used.size };
}

export function defaultApp(
  scope: FileScope,
  target: ImportTarget | null,
): string | undefined {
  if (target === null || scope.apps.length < 2) return undefined;
  const wanted = [target.storeAppId, target.name ?? ""]
    .map(headerKey)
    .filter((key) => key !== "");
  return scope.apps.find(
    (app) =>
      wanted.includes(app.value) || wanted.includes(headerKey(app.label)),
  )?.value;
}

export function applyScope(
  data: readonly CsvRecord[],
  scope: FileScope,
  app: string | undefined,
  store: Store | undefined,
): ScopedRecords {
  const kept: CsvRecord[] = [];
  let otherApps = 0;
  let otherStore = 0;
  for (const record of data) {
    const appKey =
      app === undefined || scope.appColumn === null
        ? ""
        : headerKey(cellOf(record, scope.appColumn));
    const platform =
      store === undefined || scope.platformColumn === null
        ? undefined
        : storeOfPlatform(cellOf(record, scope.platformColumn));
    if (appKey !== "" && appKey !== app) otherApps += 1;
    else if (platform !== undefined && platform !== store) otherStore += 1;
    else kept.push(record);
  }
  return { records: kept, otherApps, otherStore };
}
