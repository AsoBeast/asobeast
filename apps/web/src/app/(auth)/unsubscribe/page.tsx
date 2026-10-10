import { Suspense } from "react";
import { UnsubscribeContent } from "@/components/auth/UnsubscribeContent";

export default function UnsubscribePage() {
  return (
    <Suspense>
      <UnsubscribeContent />
    </Suspense>
  );
}
