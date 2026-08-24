import { App, AppSnapshot, Prisma } from '@prisma/client';
import {
  AppDetail,
  AppGroupSummary,
  AppListItem,
  AppSnapshotSummary,
  CompetitorItem,
} from '@asobeast/shared';
import { NormalizedApp } from '../store-providers/types';

const STORE_ORDER: Record<App['store'], number> = {
  APP_STORE: 0,
  GOOGLE_PLAY: 1,
};

export function toSnapshotSummary(snapshot: AppSnapshot): AppSnapshotSummary {
  return {
    id: snapshot.id,
    title: snapshot.title,
    subtitle: snapshot.subtitle,
    summary: snapshot.summary,
    ratingAvg: snapshot.ratingAvg,
    ratingCount: snapshot.ratingCount,
    installs: snapshot.installs === null ? null : Number(snapshot.installs),
    price: snapshot.price,
    version: snapshot.version,
    capturedAt: snapshot.capturedAt.toISOString(),
  };
}

export function toCompetitorItem(
  app: App,
  snapshot: AppSnapshot | null,
): CompetitorItem {
  return {
    id: app.id,
    store: app.store,
    name: app.name,
    iconUrl: app.iconUrl,
    latestSnapshot: snapshot ? toSnapshotSummary(snapshot) : null,
  };
}

export function toAppListItem(
  app: App,
  snapshot: AppSnapshot | null,
  trackedKeywordCount: number,
  competitorCount: number,
): AppListItem {
  return {
    id: app.id,
    store: app.store,
    country: app.country,
    name: app.name,
    iconUrl: app.iconUrl,
    ratingAvg: snapshot?.ratingAvg ?? null,
    ratingCount: snapshot?.ratingCount ?? null,
    capturedAt: snapshot ? snapshot.capturedAt.toISOString() : null,
    trackedKeywordCount,
    competitorCount,
    groupId: app.groupId,
  };
}

export type GroupWithApps = { id: string; name: string; apps: App[] };

export function toAppGroupSummary(group: GroupWithApps): AppGroupSummary {
  return {
    id: group.id,
    name: group.name,
    members: [...group.apps]
      .sort((a, b) => STORE_ORDER[a.store] - STORE_ORDER[b.store])
      .map((member) => ({
        id: member.id,
        store: member.store,
        country: member.country,
        name: member.name,
        iconUrl: member.iconUrl,
      })),
  };
}

export type CompetitorWithSnapshot = App & { snapshots: AppSnapshot[] };

export function toAppDetail(
  app: App,
  snapshot: AppSnapshot | null,
  competitors: CompetitorWithSnapshot[],
  group: GroupWithApps | null,
): AppDetail {
  return {
    id: app.id,
    store: app.store,
    storeAppId: app.storeAppId,
    country: app.country,
    name: app.name,
    iconUrl: app.iconUrl,
    createdAt: app.createdAt.toISOString(),
    latestSnapshot: snapshot ? toSnapshotSummary(snapshot) : null,
    competitors: competitors.map((competitor) =>
      toCompetitorItem(competitor, competitor.snapshots[0] ?? null),
    ),
    group: group ? toAppGroupSummary(group) : null,
  };
}

export function toSnapshotData(
  appId: string,
  normalized: NormalizedApp,
): Prisma.AppSnapshotCreateInput {
  return {
    app: { connect: { id: appId } },
    title: normalized.title,
    subtitle: normalized.subtitle,
    summary: normalized.summary,
    description: normalized.description,
    ratingAvg: normalized.ratingAvg,
    ratingCount: normalized.ratingCount,
    installs: normalized.installs,
    price: normalized.price,
    version: normalized.version,
    releasedAt: normalized.releasedAt,
    storeUpdatedAt: normalized.storeUpdatedAt,
    raw: normalized.raw as Prisma.InputJsonValue,
  };
}
