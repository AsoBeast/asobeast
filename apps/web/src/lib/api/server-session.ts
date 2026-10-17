import { REQUESTED_PATH_HEADER, signInTarget } from "@/lib/auth-routes";

async function requestedPath(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    return (await headers()).get(REQUESTED_PATH_HEADER);
  } catch {
    return null;
  }
}

export async function redirectRefusedRender(): Promise<void> {
  if (typeof window !== "undefined") return;
  const requested = await requestedPath();
  const target = requested === null ? null : signInTarget(requested);
  if (target === null) return;
  const { redirect } = await import("next/navigation");
  redirect(target);
}
