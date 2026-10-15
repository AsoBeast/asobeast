import { ChartAppLink } from '@asobeast/shared';

export interface WorkspaceAppRow {
  id: string;
  storeAppId: string;
  name: string | null;
  isCompetitor: boolean;
  primaryAppId: string | null;
  primaryApp: { name: string | null } | null;
}

function linkOf(app: WorkspaceAppRow): ChartAppLink {
  return app.isCompetitor
    ? {
        storeAppId: app.storeAppId,
        appId: app.id,
        primaryAppId: app.primaryAppId,
        name: app.primaryApp?.name ?? null,
        role: 'competitor',
      }
    : {
        storeAppId: app.storeAppId,
        appId: app.id,
        primaryAppId: null,
        name: app.name,
        role: 'own',
      };
}

export function chartAppLinks(
  apps: WorkspaceAppRow[],
  storeAppIds: string[],
): ChartAppLink[] {
  const order = new Map(storeAppIds.map((id, index) => [id, index]));
  const charted = apps
    .filter((app) => order.has(app.storeAppId))
    .sort(
      (a, b) => (order.get(a.storeAppId) ?? 0) - (order.get(b.storeAppId) ?? 0),
    );
  const links = new Map<string, ChartAppLink>();
  for (const app of [
    ...charted.filter((row) => !row.isCompetitor),
    ...charted.filter((row) => row.isCompetitor),
  ]) {
    if (!links.has(app.storeAppId)) links.set(app.storeAppId, linkOf(app));
  }
  return [...links.values()];
}
