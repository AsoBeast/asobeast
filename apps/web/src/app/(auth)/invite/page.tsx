import { Suspense } from "react";
import { AuthCardSkeleton } from "@/components/auth/AuthCardSkeleton";
import { AcceptInviteForm } from "@/components/auth/AcceptInviteForm";
import { getAuthStatus } from "@/lib/api";

export default async function InvitePage() {
  const { billing } = await getAuthStatus();

  return (
    <Suspense fallback={<AuthCardSkeleton description />}>
      <AcceptInviteForm billing={billing} />
    </Suspense>
  );
}
