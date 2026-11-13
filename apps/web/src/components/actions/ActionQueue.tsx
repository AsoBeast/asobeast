import type { ActionItem } from "@asobeast/shared";
import { Checkbox } from "@/components/ui/checkbox";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ActionRow } from "./ActionRow";
import type { QueueGroup } from "./queue-groups";
import { QUEUE_ROW_COLUMNS } from "./queue-layout";
import type { QueueSelection } from "./use-queue-selection";

function GroupSelect({
  group,
  selection,
}: {
  group: QueueGroup;
  selection: QueueSelection;
}) {
  const ids = group.items
    .map((item) => item.id)
    .filter((id) => selection.selectable.includes(id));
  if (ids.length === 0) {
    return <span aria-hidden className="size-11 @2xl/queue:size-6" />;
  }
  const chosen = ids.filter((id) => selection.isSelected(id)).length;

  return (
    <label className="flex size-11 items-center justify-center @2xl/queue:size-6">
      <Checkbox
        aria-label={`Select all in ${group.label}`}
        checked={
          chosen === ids.length ? true : chosen > 0 ? "indeterminate" : false
        }
        onCheckedChange={() => selection.setMany(ids, chosen < ids.length)}
      />
    </label>
  );
}

export function QueueColumnHead() {
  return (
    <div
      aria-hidden
      className={cn(
        QUEUE_ROW_COLUMNS,
        "hidden h-9 items-center border-b border-border px-4 text-label text-faint-foreground @2xl/queue:grid",
      )}
    >
      <span className="col-start-2">Priority</span>
      <span>Action</span>
      <span className="text-right">Impact</span>
    </div>
  );
}

export function ActionQueue({
  groups,
  focusedId,
  iconOf,
  hrefFor,
  onOpen,
  selection,
  keyboardId,
  onRowFocus,
}: {
  groups: QueueGroup[];
  focusedId: string;
  iconOf?: (appId: string) => string | null;
  hrefFor: (id: string) => string;
  onOpen: (item: ActionItem) => void;
  selection: QueueSelection;
  keyboardId: string | null;
  onRowFocus: (id: string) => void;
}) {
  const ids = groups.flatMap((group) => group.items.map((item) => item.id));
  const tabbableId =
    keyboardId && ids.includes(keyboardId) ? keyboardId : ids[0];

  return (
    <div className="flex flex-col">
      {groups.map((group) => (
        <div
          key={group.key}
          data-slot="action-group"
          className="border-t border-border first:border-t-0"
        >
          <div className="flex h-11 items-center gap-0 border-b border-border-subtle @2xl/queue:h-9 @2xl/queue:gap-3 @2xl/queue:px-4">
            <GroupSelect group={group} selection={selection} />
            <h3 className="text-label text-faint-foreground">
              {`${group.label} · ${formatNumber(group.items.length)}`}
            </h3>
          </div>
          <ul className="flex list-none flex-col p-0">
            {group.items.map((item) => (
              <ActionRow
                key={item.id}
                item={item}
                focused={focusedId === item.id}
                iconUrl={iconOf?.(item.scope.appId)}
                href={hrefFor(item.id)}
                onOpen={() => onOpen(item)}
                selection={selection}
                tabbable={tabbableId === item.id}
                onFocus={() => onRowFocus(item.id)}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
