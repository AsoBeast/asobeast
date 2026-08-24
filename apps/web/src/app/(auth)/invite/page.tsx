import { Suspense } from "react";
import { AcceptInviteForm } from "@/components/auth/AcceptInviteForm";

export default function InvitePage() {
  return (
    <Suspense>
      <AcceptInviteForm />
    </Suspense>
  );
}
