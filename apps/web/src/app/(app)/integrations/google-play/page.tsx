import { Suspense } from "react";
import { PlaySignInReturn } from "@/components/integrations/PlaySignInReturn";
import { PlaySignInReturnSkeleton } from "@/components/integrations/skeletons";

export default function PlaySignInPage() {
  return (
    <div className="page-reading flex flex-col gap-8">
      <Suspense fallback={<PlaySignInReturnSkeleton />}>
        <PlaySignInReturn />
      </Suspense>
    </div>
  );
}
