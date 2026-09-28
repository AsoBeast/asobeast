import type { PortfolioApp, Store } from "@asobeast/shared";

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
