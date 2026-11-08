import { Suspense } from "react";
import { AcceptInviteForm } from "@/components/auth/AcceptInviteForm";
import { getAuthStatus } from "@/lib/api";

export default async function InvitePage() {
  const { billing } = await getAuthStatus();

  return (
    <Suspense>
      <AcceptInviteForm billing={billing} />
    </Suspense>
  );
}
