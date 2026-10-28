import { cache } from "react";
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

export async function viewerIsOperator(): Promise<boolean> {
  return (await viewer())?.platformOperator === true;
}

export async function viewerAdminAccess(): Promise<AdminAccess> {
  return adminAccessOf(await viewer());
}
