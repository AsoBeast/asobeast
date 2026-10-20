import { Suspense } from "react";
import { InfoTip } from "@/components/ui/info-tip";
import { ActionStatusLine } from "./ActionStatusLine";
import { ActionStatusLineSkeleton } from "./skeletons";
import { GenerateNowButton } from "./GenerateNowButton";

const HOW_ACTIONS_ARE_GENERATED =
  "What to do next and why. Every recommendation is computed deterministically from your stored data, and findings beyond the per app cap wait until the queue has room.";

const ACTION_CENTER_GUIDE = "https://docs.asobeast.com/guides/action-center";

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
          <InfoTip
            label="About how actions are generated"
            title="How actions are generated"
            summary={HOW_ACTIONS_ARE_GENERATED}
          >
            <a
              href={ACTION_CENTER_GUIDE}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-2"
            >
              Read how the Action Center works
            </a>
          </InfoTip>
        </div>
        {showGenerate ? <GenerateNowButton generatedAt={generatedAt} /> : null}
      </div>
      <Suspense fallback={<ActionStatusLineSkeleton />}>
        <ActionStatusLine appId={appId} />
      </Suspense>
    </header>
  );
}
