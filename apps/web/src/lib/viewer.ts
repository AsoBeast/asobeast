import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import type { AuthUser } from "@asobeast/shared";
import { ApiError, getAuthMe } from "@/lib/api";
import { adminAccessOf, type AdminAccess } from "@/lib/admin-access";

const REFUSALS = new Set([401, 402, 403, 404]);

async function signedInViewer(): Promise<AuthUser | null> {
  try {
    return await getAuthMe();
  } catch (error) {
    if (error instanceof ApiError && REFUSALS.has(error.envelope.statusCode)) {
      return null;
    }
    throw error;
  }
}

export const viewer = cache(signedInViewer);

export const ENTRY_STEP_WAIT_MS = 3_000;

export async function viewerWhenAnswered(): Promise<AuthUser | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unanswered = new Promise<null>((resolve) => {
    timer = setTimeout(resolve, ENTRY_STEP_WAIT_MS, null);
  });
  try {
    return await Promise.race([
      viewer().catch((error: unknown) => {
        unstable_rethrow(error);
        return null;
      }),
      unanswered,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function viewerIsOperator(): Promise<boolean> {
  return (await viewer())?.platformOperator === true;
}

export async function viewerAdminAccess(): Promise<AdminAccess> {
  return adminAccessOf(await viewer());
}
