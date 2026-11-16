import { Suspense } from "react";
import { AuthCardSkeleton } from "@/components/auth/AuthCardSkeleton";
import { VerifyEmailContent } from "@/components/auth/VerifyEmailContent";

export default function VerifyPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
