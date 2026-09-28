import { normalizeText } from "@asobeast/shared";
import type {
  PortfolioApp,
  PortfolioAppInsight,
  Store,
} from "@asobeast/shared";
import { storeLabel } from "@/lib/format";
import type { AppSort } from "@/lib/search-params";
import type { SortDirection } from "@/lib/table/sorting";

const STORE_ORDER: Record<Store, number> = {
  APP_STORE: 0,
  GOOGLE_PLAY: 1,
};

export type GroupVariant = "linked" | "storefront";

export type PortfolioRow =
  | { kind: "app"; app: PortfolioApp }
  | {
      kind: "group";
      id: string;
      name: string;
      variant: GroupVariant;
      members: PortfolioApp[];
    };

function storefrontKey(app: PortfolioApp): string {
  return `${app.store}:${app.storeAppId}`;
}

export function orderMembers(members: PortfolioApp[]): PortfolioApp[] {
  return [...members].sort(
    (a, b) =>
      STORE_ORDER[a.store] - STORE_ORDER[b.store] ||
      a.country.localeCompare(b.country),
  );
}

export function toRows(apps: PortfolioApp[]): PortfolioRow[] {
  const storefrontCounts = new Map<string, number>();
  for (const app of apps) {
    if (app.groupId === null) {
      const key = storefrontKey(app);
      storefrontCounts.set(key, (storefrontCounts.get(key) ?? 0) + 1);
    }
  }

  const rows: PortfolioRow[] = [];
  const groupRowIndex = new Map<string, number>();

  const pushMember = (
    key: string,
    row: Omit<PortfolioRow & { kind: "group" }, "members">,
    app: PortfolioApp,
  ) => {
    const existing = groupRowIndex.get(key);
    if (existing === undefined) {
      groupRowIndex.set(key, rows.length);
      rows.push({ ...row, members: [app] });
      return;
    }
    (rows[existing] as { members: PortfolioApp[] }).members.push(app);
  };

  for (const app of apps) {
    if (app.groupId !== null) {
      pushMember(
        `group:${app.groupId}`,
        {
          kind: "group",
          id: app.groupId,
          name: app.groupName ?? app.name ?? "App group",
          variant: "linked",
        },
        app,
      );
      continue;
    }

    const key = storefrontKey(app);
    if ((storefrontCounts.get(key) ?? 0) < 2) {
      rows.push({ kind: "app", app });
      continue;
    }

    pushMember(
      `storefront:${key}`,
      {
        kind: "group",
        id: key,
        name: app.name ?? "Untitled app",
        variant: "storefront",
      },
      app,
    );
  }

  return rows;
}

type SortValue = number | string | null;

export const APP_SORT_VALUES: Record<
  AppSort,
  {
    descFirst: boolean;
    value: (app: PortfolioApp, insight?: PortfolioAppInsight) => SortValue;
  }
> = {
  visibility: { descFirst: true, value: (app) => app.visibility.current },
  change: { descFirst: true, value: (app) => app.visibility.delta7d },
  top10: {
    descFirst: true,
    value: (_app, insight) => insight?.rankDistribution.top10 ?? null,
  },
  rating: {
    descFirst: true,
    value: (_app, insight) => insight?.rating.average ?? null,
  },
  actions: {
    descFirst: true,
    value: (_app, insight) => insight?.actions?.open ?? null,
  },
  name: { descFirst: false, value: (app) => app.name ?? "" },
  updated: { descFirst: true, value: (app) => app.lastCapturedAt },
};

export interface AppSorting {
  sort: AppSort;
  dir: SortDirection | null;
}

function compareValues(a: SortValue, b: SortValue, desc: boolean): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  const order =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b));
  return desc ? -order : order;
}

export function sortRows(
  rows: PortfolioRow[],
  { sort, dir }: AppSorting,
  insights: ReadonlyMap<string, PortfolioAppInsight>,
): PortfolioRow[] {
  const { descFirst, value } = APP_SORT_VALUES[sort];
  const desc = dir === null ? descFirst : dir === "desc";
  const appValue = (app: PortfolioApp) => value(app, insights.get(app.id));
  const rowValue = (row: PortfolioRow): SortValue => {
    if (row.kind === "app") return appValue(row.app);
    if (sort === "name") return row.name;
    return (
      row.members
        .map(appValue)
        .sort((a, b) => compareValues(a, b, descFirst))[0] ?? null
    );
  };
  return rows
    .map((row) => ({ row, value: rowValue(row) }))
    .sort((a, b) => compareValues(a.value, b.value, desc))
    .map(({ row }) => row);
}

const searchable = (text: string): string =>
  normalizeText(text).normalize("NFD").replace(/\p{M}/gu, "");

export function matchesQuery(app: PortfolioApp, query: string): boolean {
  const needle = searchable(query);
  if (needle === "") return true;
  const haystack = searchable(
    [
      app.name ?? "",
      storeLabel(app.store),
      app.country,
      app.groupName ?? "",
    ].join(" "),
  );
  return haystack.includes(needle);
}

export function filterRows(
  rows: PortfolioRow[],
  query: string,
): PortfolioRow[] {
  return rows.filter((row) =>
    row.kind === "app"
      ? matchesQuery(row.app, query)
      : row.members.some((member) => matchesQuery(member, query)),
  );
}
