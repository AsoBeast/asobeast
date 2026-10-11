import { Suspense } from "react";
import { ConfirmAlertContent } from "@/components/auth/ConfirmAlertContent";

export default function ConfirmAlertPage() {
  return (
    <Suspense>
      <ConfirmAlertContent />
    </Suspense>
  );
}
