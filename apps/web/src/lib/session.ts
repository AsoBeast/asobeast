import { getAuthStatus } from "@/lib/api";

export class SessionNotKeptError extends Error {
  constructor() {
    super("The browser did not keep the session cookie.");
    this.name = "SessionNotKeptError";
  }
}

const SESSION_CHECK_TIMEOUT_MS = 5_000;

async function sessionIsKept(): Promise<boolean> {
  try {
    const status = await getAuthStatus({
      signal: AbortSignal.timeout(SESSION_CHECK_TIMEOUT_MS),
    });
    return status.authenticated;
  } catch {
    return true;
  }
}

export async function holdSession<T>(establish: () => Promise<T>): Promise<T> {
  const established = await establish();
  if (!(await sessionIsKept())) throw new SessionNotKeptError();
  return established;
}
