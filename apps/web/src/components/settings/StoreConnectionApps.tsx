import type { StoreConnectionApp } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { appStateLabel, historyLine } from "@/lib/store-connection-copy";

export function StoreConnectionApps({ apps }: { apps: StoreConnectionApp[] }) {
  if (apps.length === 0) {
    return (
      <p className="text-body text-muted-foreground">
        Import an App Store app to read its numbers through this key.
      </p>
    );
  }
  return (
    <ul
      aria-label="Apps this key reports"
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
            {appStateLabel(app.state)}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
