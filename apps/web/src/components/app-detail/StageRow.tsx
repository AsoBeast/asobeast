import { CheckCircle2, LoaderCircle } from "lucide-react";

const DEFAULT_STATES = { ready: "Ready", waiting: "Waiting" };

export interface StageRowProps {
  label: string;
  ready: boolean;
  progress: string | null;
  detail: string;
  states?: { ready: string; waiting: string };
}

export function StageRow({
  label,
  ready,
  progress,
  detail,
  states = DEFAULT_STATES,
}: StageRowProps) {
  const Icon = ready ? CheckCircle2 : LoaderCircle;

  return (
    <li className="flex items-start gap-3">
      <Icon
        aria-hidden="true"
        className={
          ready
            ? "mt-0.5 size-4 shrink-0 text-muted-foreground"
            : "mt-0.5 size-4 shrink-0 animate-spin text-primary"
        }
      />
      <div className="flex flex-col gap-0.5">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
          <span>{label}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {ready ? states.ready : states.waiting}
            {progress ? ` · ${progress}` : ""}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}
