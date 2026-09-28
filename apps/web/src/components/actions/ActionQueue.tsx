import type { ActionItem } from "@asobeast/shared";
import { Checkbox } from "@/components/ui/checkbox";
import { formatNumber } from "@/lib/format";
import { ActionRow } from "./ActionRow";
import type { QueueGroup } from "./queue-groups";
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
  if (ids.length === 0) return null;
  const chosen = ids.filter((id) => selection.isSelected(id)).length;

  return (
    <Checkbox
      aria-label={`Select all in ${group.label}`}
      checked={
        chosen === ids.length ? true : chosen > 0 ? "indeterminate" : false
      }
      onCheckedChange={() => selection.setMany(ids, chosen < ids.length)}
    />
  );
}

export function ActionQueue({
  groups,
  focusedId,
  appScoped,
  hrefFor,
  onOpen,
  selection,
}: {
  groups: QueueGroup[];
  focusedId: string;
  appScoped: boolean;
  hrefFor: (id: string) => string;
  onOpen: (item: ActionItem) => void;
  selection: QueueSelection;
}) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div
          key={group.key}
          data-slot="action-group"
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-3">
            <GroupSelect group={group} selection={selection} />
            <h3 className="text-label text-muted-foreground uppercase">
              {group.label} · {formatNumber(group.items.length)}
            </h3>
          </div>
          <ul className="flex list-none flex-col gap-2 p-0">
            {group.items.map((item) => (
              <ActionRow
                key={item.id}
                item={item}
                focused={focusedId === item.id}
                appScoped={appScoped}
                href={hrefFor(item.id)}
                onOpen={() => onOpen(item)}
                selection={selection}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
