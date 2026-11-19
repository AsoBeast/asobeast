import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCardSkeleton } from "@/components/auth/AuthCardSkeleton";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { SignUpStepsAbove } from "@/components/auth/SignUpSteps";
import { getAuthStatus } from "@/lib/api";
import { REGISTRATION_CLOSED_LOGIN } from "@/lib/auth-routes";
import { registerSteps } from "@/lib/sign-up-steps";

export default async function RegisterPage() {
  const status = await getAuthStatus();
  if (status.authenticated) redirect("/");
  if (!status.registrationOpen) redirect(REGISTRATION_CLOSED_LOGIN);

  const steps = status.billing
    ? registerSteps(status.confirmsEmail === true)
    : [];

  return (
    <SignUpStepsAbove steps={steps}>
      <Suspense fallback={<AuthCardSkeleton />}>
        <RegisterForm billing={status.billing} />
      </Suspense>
    </SignUpStepsAbove>
  );
}
