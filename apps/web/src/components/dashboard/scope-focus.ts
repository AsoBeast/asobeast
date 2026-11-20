import { BREAKDOWN_MORE_ID, breakdownRowId } from "./breakdown";

const SELECTED_TILE = '[data-slot="stat-tile"][aria-pressed="true"]';

const LEAVING = "leaves";

export const leavingProps = (leaves: boolean) =>
  leaves ? { [`data-${LEAVING}`]: "" } : {};

export function focusScopeSurvivor(id: string): void {
  const row = document.getElementById(breakdownRowId(id));
  const staying = row !== null && row.dataset[LEAVING] === undefined;
  const survivor = staying
    ? row
    : (document.getElementById(BREAKDOWN_MORE_ID) ??
      document.querySelector<HTMLElement>(SELECTED_TILE));
  survivor?.focus();
}
