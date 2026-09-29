import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatRankPosition } from "@asobeast/shared";
import type { KeywordMover } from "@asobeast/shared";
import { GradedNumber } from "@/components/ui/graded";
import { grade } from "@/lib/grade";
import { cn } from "@/lib/utils";

export function MoverRow({
  href,
  mover,
  context,
  className,
}: {
  href: string;
  mover: KeywordMover;
  context?: ReactNode;
  className?: string;
}) {
  const positions = (
    <span className="flex shrink-0 items-center gap-1 numeric font-mono text-muted-foreground">
      {formatRankPosition(mover.from, mover.fromDepth)}
      <ArrowRight className="size-3" />
      {mover.to === null ? (
        formatRankPosition(mover.to, mover.toDepth)
      ) : (
        <GradedNumber
          value={formatRankPosition(mover.to, mover.toDepth)}
          grade={grade("position", mover.to)}
          label="Position"
        />
      )}
    </span>
  );

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted",
        className,
      )}
    >
      <span className="truncate print:whitespace-normal">{mover.text}</span>
      {context ? (
        <span className="flex shrink-0 items-center gap-2">
          {context}
          {positions}
        </span>
      ) : (
        positions
      )}
    </Link>
  );
}

export function MoverList<T extends KeywordMover>({
  title,
  movers,
  renderHref,
  renderContext,
  rowClassName,
}: {
  title?: string;
  movers: T[];
  renderHref: (mover: T) => string;
  renderContext?: (mover: T) => ReactNode;
  rowClassName?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {title ? (
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
      ) : null}
      {movers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No movement this week.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {movers.map((mover) => {
            const href = renderHref(mover);
            return (
              <li key={href}>
                <MoverRow
                  href={href}
                  mover={mover}
                  context={renderContext?.(mover)}
                  className={rowClassName}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
