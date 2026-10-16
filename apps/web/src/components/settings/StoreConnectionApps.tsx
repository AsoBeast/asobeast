import type { Store, StoreConnectionApp } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import {
  appStateLabel,
  historyLine,
  STORE_CONSOLES,
} from "@/lib/store-connection-copy";

export function StoreConnectionApps({
  store,
  apps,
}: {
  store: Store;
  apps: StoreConnectionApp[];
}) {
  const copy = STORE_CONSOLES[store];
  if (apps.length === 0) {
    return <p className="text-body text-muted-foreground">{copy.noApps}</p>;
  }
  return (
    <ul
      aria-label={copy.appsLabel}
      className="flex flex-col divide-y rounded-xl border"
    >
      {apps.map((app) => (
        <li
          key={app.appId}
          className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
        >
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">
              {app.name ?? app.appId}
            </span>
            <span className="text-xs text-muted-foreground">
              {historyLine(app)}
            </span>
          </div>
          <Badge variant={app.state === "requested" ? "success" : "outline"}>
            {appStateLabel(app.state, store)}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
