import type { SupportWorkspaceSummary } from "@asobeast/shared";
import { SheetSection } from "@/components/layout/SheetSection";
import { availableActions } from "@/lib/admin-support";
import { SectionNote } from "./SectionNote";
import { SupportActionDialog } from "./SupportActionDialog";

export function WorkspaceActions({
  workspace,
}: {
  workspace: SupportWorkspaceSummary;
}) {
  const actions = availableActions(workspace);
  return (
    <SheetSection title="Support actions">
      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <SupportActionDialog
              key={action}
              workspaceId={workspace.workspaceId}
              name={workspace.name}
              action={action}
            />
          ))}
        </div>
      ) : null}
      {workspace.operatorWorkspace ? (
        <SectionNote>Your own workspace cannot be suspended.</SectionNote>
      ) : null}
    </SheetSection>
  );
}
