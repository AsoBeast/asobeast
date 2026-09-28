import { Suspense } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ActionStatusLine } from "./ActionStatusLine";
import { ActionStatusLineSkeleton } from "./skeletons";
import { GenerateNowButton } from "./GenerateNowButton";

const HOW_ACTIONS_ARE_GENERATED =
  "What to do next and why. Every recommendation is computed deterministically from your stored data, and findings beyond the per app cap wait until the queue has room.";

export function ActionCenterHeader({
  appId,
  generatedAt,
  showGenerate,
}: {
  appId?: string;
  generatedAt: string | null;
  showGenerate: boolean;
}) {
  const Heading = appId ? "h2" : "h1";

  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Heading
            className={
              appId ? "text-title" : "text-display tracking-tight text-balance"
            }
          >
            {appId ? "Actions" : "Action Center"}
          </Heading>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="How actions are generated"
              >
                <Info aria-hidden className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {HOW_ACTIONS_ARE_GENERATED}
            </TooltipContent>
          </Tooltip>
        </div>
        {showGenerate ? <GenerateNowButton generatedAt={generatedAt} /> : null}
      </div>
      <Suspense fallback={<ActionStatusLineSkeleton />}>
        <ActionStatusLine appId={appId} />
      </Suspense>
    </header>
  );
}
