import { Suspense } from "react";
import { VerifyEmailContent } from "@/components/auth/VerifyEmailContent";

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
