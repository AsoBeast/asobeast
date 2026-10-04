import { getAuthStatus } from "@/lib/api";

export class SessionNotKeptError extends Error {
  constructor() {
    super("The browser did not keep the session cookie.");
    this.name = "SessionNotKeptError";
  }
}

async function sessionIsKept(): Promise<boolean> {
  try {
    return (await getAuthStatus()).authenticated;
  } catch {
    return true;
  }
}

export async function holdSession<T>(establish: () => Promise<T>): Promise<T> {
  const established = await establish();
  if (!(await sessionIsKept())) throw new SessionNotKeptError();
  return established;
}
