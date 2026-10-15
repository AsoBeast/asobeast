import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportAppDialog } from "./ImportAppDialog";

const DELIVERIES = [
  "Positions for the keywords in your title and subtitle, within minutes.",
  "A comparison against every competitor you add, on every keyword you track.",
  "A queue of what to change, once a week of daily captures is in.",
];

export function FirstRun() {
  return (
    <div className="page-reading flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-20 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-display tracking-tight text-balance">
          Track your first app
        </h1>
        <p className="text-body text-muted-foreground">
          Type your app&apos;s name or paste its store URL.
        </p>
      </div>
      <ul
        aria-label="What you get"
        className="flex max-w-md flex-col gap-2 text-left"
      >
        {DELIVERIES.map((delivery) => (
          <li
            key={delivery}
            className="flex items-start gap-2 text-body text-muted-foreground"
          >
            <CheckCircle2
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-success"
            />
            {delivery}
          </li>
        ))}
      </ul>
      <ImportAppDialog>
        <Button size="lg">Import app</Button>
      </ImportAppDialog>
    </div>
  );
}
