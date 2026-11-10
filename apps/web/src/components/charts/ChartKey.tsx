import { PENDING_LINE_PROPS } from "./theme";

export interface ChartKeyItem {
  label: string;
  color: string;
  mark: "line" | "dash" | "square";
}

function Mark({ color, mark }: Pick<ChartKeyItem, "color" | "mark">) {
  if (mark === "square") {
    return (
      <span
        aria-hidden
        className="size-2 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
    );
  }
  return (
    <svg aria-hidden width="16" height="8" viewBox="0 0 16 8">
      <line
        x1="0"
        y1="4"
        x2="16"
        y2="4"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={
          mark === "dash" ? PENDING_LINE_PROPS.strokeDasharray : undefined
        }
      />
    </svg>
  );
}

export function ChartKey({
  label,
  items,
}: {
  label: string;
  items: ChartKeyItem[];
}) {
  if (items.length === 0) return null;
  return (
    <ul
      aria-label={label}
      className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-label text-muted-foreground"
    >
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <Mark color={item.color} mark={item.mark} />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
