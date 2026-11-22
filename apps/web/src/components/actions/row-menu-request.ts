import { createContext, useContext } from "react";

export type RowMenuFocus = "first" | "dismiss";

export interface RowMenuRequest {
  id: string;
  focus: RowMenuFocus;
}

export const RowMenuRequestContext = createContext<{
  request: RowMenuRequest | null;
  settle: () => void;
}>({ request: null, settle: () => {} });

export function useRowMenuRequest(id: string) {
  const { request, settle } = useContext(RowMenuRequestContext);
  return { focus: request?.id === id ? request.focus : null, settle };
}
