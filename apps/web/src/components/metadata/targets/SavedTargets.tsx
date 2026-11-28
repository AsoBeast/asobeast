import { formatNumber } from "@/lib/format";
import { slotLabel, type TargetSlots } from "@/lib/listing-targets";
import { MORE_SLOTS, ROLE_SLOTS } from "./TargetsBody";

export function SavedTargets({ slots }: { slots: TargetSlots }) {
  const more = MORE_SLOTS.filter((index) => slots[index] !== null).length;
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
      <ul
        aria-label="Saved targets"
        className="flex list-none flex-wrap items-baseline gap-x-6 gap-y-2 p-0"
      >
        {ROLE_SLOTS.map((index) => {
          const phrase = slots[index];
          return (
            <li key={index} className="flex min-w-0 items-baseline gap-2">
              <span className="text-label text-muted-foreground">
                {slotLabel(index)}
              </span>
              {phrase === null ? (
                <span className="text-dense text-faint-foreground">
                  Not set
                </span>
              ) : (
                <span
                  translate="no"
                  dir="auto"
                  className="min-w-0 text-dense font-medium wrap-anywhere"
                >
                  {phrase}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {more > 0 ? (
        <span className="text-caption text-muted-foreground">
          {`and ${formatNumber(more)} more`}
        </span>
      ) : null}
    </div>
  );
}
