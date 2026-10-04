import { ApiError, getAuthMe } from "@/lib/api";

const REFUSALS = new Set([401, 402, 403, 404]);

export async function viewerIsOperator(): Promise<boolean> {
  try {
    const user = await getAuthMe();
    return user.platformOperator;
  } catch (error) {
    if (error instanceof ApiError && REFUSALS.has(error.envelope.statusCode)) {
      return false;
    }
    throw error;
  }
}
