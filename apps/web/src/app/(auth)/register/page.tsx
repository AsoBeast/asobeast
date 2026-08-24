import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { getAuthStatus } from "@/lib/api";

export default async function RegisterPage() {
  const status = await getAuthStatus();
  if (!status.registrationOpen) redirect("/login");
  if (status.authenticated) redirect("/");

  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
