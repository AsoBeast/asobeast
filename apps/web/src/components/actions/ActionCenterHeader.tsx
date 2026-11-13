import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { LEDE, META_LINE } from "@/components/layout/panel-classes";
import { GenerateNowButton } from "./GenerateNowButton";
import { RunFacts, RunLede } from "./RunLede";
import { TextLineSkeleton } from "./skeletons";

export function ActionCenterHeader({
  appId,
  generatedAt,
  showGenerate,
}: {
  appId?: string;
  generatedAt: string | null;
  showGenerate: boolean;
}) {
  const generate = showGenerate ? (
    <GenerateNowButton generatedAt={generatedAt} variant="outline" />
  ) : null;
  const lede = (
    <Suspense fallback={<TextLineSkeleton width="w-80" />}>
      <RunLede appId={appId} />
    </Suspense>
  );
  const facts = (
    <Suspense fallback={<TextLineSkeleton width="w-56" />}>
      <RunFacts appId={appId} />
    </Suspense>
  );

  if (appId === undefined) {
    return (
      <header>
        <PageHeader
          title="Action Center"
          controls={generate}
          lede={lede}
          meta={facts}
        />
      </header>
    );
  }
  return (
    <PageHeader title="Actions" titleHidden>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-2">
          <p className={LEDE}>{lede}</p>
          <p className={META_LINE}>{facts}</p>
        </div>
        {generate}
      </div>
    </PageHeader>
  );
}
