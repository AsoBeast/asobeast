import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { getAuthStatus } from "@/lib/api";

export default async function ForgotPasswordPage() {
  const status = await getAuthStatus();
  if (status.setupRequired) redirect("/register");

  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
