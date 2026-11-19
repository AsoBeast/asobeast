"use client";

import { useDeferredValue, useRef } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { WORKSPACE_STAGES } from "@asobeast/shared";
import { FacetFilter } from "@/components/data-table/FacetFilter";
import {
  FiltersPopover,
  FiltersSheet,
} from "@/components/data-table/FiltersControl";
import { workspaceMatches } from "@/lib/admin-search";
import {
  ADMIN_FLAG_LABELS,
  WORKSPACE_STAGE_LABELS,
  matchesStanding,
  workspaceFlags,
} from "@/lib/admin-stages";
import { adminWorkspacesOptions, authStatusOptions } from "@/lib/queries";
import {
  ADMIN_WORKSPACE_FLAGS,
  ADMIN_WORKSPACE_SHEET_KEY,
  adminWorkspaceListParsers,
  adminWorkspaceSheetParser,
  adminWorkspaceSortParser,
} from "@/lib/search-params";
import { countBy } from "@/lib/table/facets";
import { useUrlSheet } from "@/lib/use-url-sheet";
import { AdminList } from "./AdminList";
import { useAdminTable } from "./useAdminTable";
import { workspaceColumns } from "./workspace-columns";
import { WorkspaceSheet } from "./workspace-sheet/WorkspaceSheet";
import { WorkspaceSheetContext } from "./workspace-sheet/workspace-sheet-context";

const STAGE_OPTIONS = WORKSPACE_STAGES.filter(
  (stage) => stage !== "self-hosted",
).map((stage) => ({ value: stage, label: WORKSPACE_STAGE_LABELS[stage] }));

const FLAG_OPTIONS = ADMIN_WORKSPACE_FLAGS.map((flag) => ({
  value: flag,
  label: ADMIN_FLAG_LABELS[flag],
}));

const FILTERS_DESCRIPTION =
  "Narrow the workspaces by billing stage and by what needs a look.";

export function AdminWorkspaces() {
  const { data: workspaces, dataUpdatedAt } = useSuspenseQuery(
    adminWorkspacesOptions,
  );
  const { data: status } = useSuspenseQuery(authStatusOptions);
  const [{ q, stage, flag, sort, dir }, setList] = useQueryStates(
    adminWorkspaceListParsers,
  );
  const sheet = useUrlSheet(
    ADMIN_WORKSPACE_SHEET_KEY,
    adminWorkspaceSheetParser,
  );
  const query = useDeferredValue(q);
  const narrowerFilters = useRef<HTMLDivElement>(null);
  const widerFilters = useRef<HTMLDivElement>(null);
  const searched = workspaces.filter((workspace) =>
    workspaceMatches(workspace, query),
  );

  const table = useAdminTable({
    name: "admin-workspaces",
    data: searched.filter((workspace) =>
      matchesStanding(workspace, { stage, flag }, dataUpdatedAt),
    ),
    columns: workspaceColumns,
    getRowId: (workspace) => workspace.workspaceId,
    sort: { sort, dir },
    onSort: (next) =>
      void setList({
        sort:
          next.sort === null ? null : adminWorkspaceSortParser.parse(next.sort),
        dir: next.dir,
      }),
    billing: status.billing,
    billingColumns: [],
  });

  const facets = (
    <>
      {status.billing ? (
        <FacetFilter
          title="Stage"
          options={STAGE_OPTIONS}
          selected={stage}
          counts={countBy(searched, (workspace) => workspace.stage ?? null)}
          onChange={(next) => void setList({ stage: next })}
        />
      ) : null}
      <FacetFilter
        title="Needs a look"
        options={FLAG_OPTIONS}
        selected={flag}
        counts={countBy(
          searched.flatMap((workspace) =>
            workspaceFlags(workspace, dataUpdatedAt),
          ),
          (value) => value,
        )}
        onChange={(next) => void setList({ flag: next })}
      />
    </>
  );
  const active = stage.length + flag.length;

  return (
    <WorkspaceSheetContext value={sheet.open}>
      <AdminList
        table={table}
        caption="Workspaces on this instance"
        noun="workspace"
        loaded={workspaces.length}
        total={workspaces.length}
        billing={status.billing}
        billingColumns={[]}
        search={q}
        onSearch={(next, options) => void setList({ q: next }, options)}
        filters={
          <>
            <div ref={narrowerFilters} className="contents md:hidden">
              <FiltersSheet
                active={active}
                otherWidth={widerFilters}
                description={FILTERS_DESCRIPTION}
              >
                {facets}
              </FiltersSheet>
            </div>
            <div ref={widerFilters} className="hidden md:contents">
              <FiltersPopover active={active} otherWidth={narrowerFilters}>
                {facets}
              </FiltersPopover>
            </div>
          </>
        }
        chips={[
          ...stage.map((value) => ({
            key: `stage-${value}`,
            label: `Stage: ${WORKSPACE_STAGE_LABELS[value]}`,
            onRemove: () =>
              void setList({ stage: stage.filter((entry) => entry !== value) }),
          })),
          ...flag.map((value) => ({
            key: `flag-${value}`,
            label: ADMIN_FLAG_LABELS[value],
            onRemove: () =>
              void setList({ flag: flag.filter((entry) => entry !== value) }),
          })),
        ]}
        onClearFilters={() =>
          void setList({ q: null, stage: null, flag: null })
        }
        reads="Each read is written to the support audit trail."
      />
      <WorkspaceSheet
        shownId={sheet.shownId}
        billing={status.billing}
        onClose={sheet.close}
      />
    </WorkspaceSheetContext>
  );
}
