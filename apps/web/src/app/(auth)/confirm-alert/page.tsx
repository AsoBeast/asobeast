import { Suspense } from "react";
import { AuthCardSkeleton } from "@/components/auth/AuthCardSkeleton";
import { ConfirmAlertContent } from "@/components/auth/ConfirmAlertContent";

export default function ConfirmAlertPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <ConfirmAlertContent />
    </Suspense>
  );
}
