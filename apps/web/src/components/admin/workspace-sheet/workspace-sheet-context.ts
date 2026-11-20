import { createContext } from "react";

export const WorkspaceSheetContext = createContext<
  ((workspaceId: string) => void) | null
>(null);
