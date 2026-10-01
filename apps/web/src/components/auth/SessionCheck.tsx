import { Loader2 } from "lucide-react";

export function SessionCheck() {
  return (
    <div role="status" aria-label="Checking your session">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
