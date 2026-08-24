import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { getAuthStatus } from "@/lib/api";

export default async function LoginPage() {
  const status = await getAuthStatus();
  if (status.setupRequired) redirect("/register");
  if (status.authenticated) redirect("/");

  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
