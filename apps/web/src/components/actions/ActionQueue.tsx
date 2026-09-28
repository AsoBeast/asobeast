import type { ActionItem } from "@asobeast/shared";
import { formatNumber } from "@/lib/format";
import { ActionRow } from "./ActionRow";
import type { QueueGroup } from "./queue-groups";

export function ActionQueue({
  groups,
  focusedId,
  appScoped,
  hrefFor,
  onOpen,
}: {
  groups: QueueGroup[];
  focusedId: string;
  appScoped: boolean;
  hrefFor: (id: string) => string;
  onOpen: (item: ActionItem) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div
          key={group.key}
          data-slot="action-group"
          className="flex flex-col gap-2"
        >
          <h3 className="text-label text-muted-foreground uppercase">
            {group.label} · {formatNumber(group.items.length)}
          </h3>
          <ul className="flex list-none flex-col gap-2 p-0">
            {group.items.map((item) => (
              <ActionRow
                key={item.id}
                item={item}
                focused={focusedId === item.id}
                appScoped={appScoped}
                href={hrefFor(item.id)}
                onOpen={() => onOpen(item)}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
