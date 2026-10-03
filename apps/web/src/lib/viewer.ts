import { ApiError, getAuthMe } from "@/lib/api";

export async function viewerIsOperator(): Promise<boolean> {
  try {
    const user = await getAuthMe();
    return user.platformOperator;
  } catch (error) {
    if (error instanceof ApiError) return false;
    throw error;
  }
}
