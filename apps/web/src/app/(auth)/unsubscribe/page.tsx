import { Suspense } from "react";
import { AuthCardSkeleton } from "@/components/auth/AuthCardSkeleton";
import { UnsubscribeContent } from "@/components/auth/UnsubscribeContent";

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <UnsubscribeContent />
    </Suspense>
  );
}
