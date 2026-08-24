import { Button } from "@/components/ui/button";
import { ImportAppDialog } from "./ImportAppDialog";

export function FirstRun() {
  return (
    <div className="page-reading flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-20 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-display tracking-tight text-balance">
          Track your first app
        </h1>
        <p className="text-body text-muted-foreground">
          Paste an App Store or Google Play URL. asobeast imports the listing,
          extracts keywords and starts checking ranks on the next daily run.
        </p>
      </div>
      <ImportAppDialog>
        <Button size="lg">Import app</Button>
      </ImportAppDialog>
    </div>
  );
}
