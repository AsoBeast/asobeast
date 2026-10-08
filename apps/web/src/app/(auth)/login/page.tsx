import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { getAuthStatus } from "@/lib/api";
import { signedInDestination } from "@/lib/auth-routes";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const status = await getAuthStatus();
  if (status.setupRequired) redirect("/register");
  if (status.authenticated) {
    const { next } = await searchParams;
    redirect(signedInDestination(Array.isArray(next) ? next[0] : next));
  }

  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
