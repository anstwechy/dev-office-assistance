import type { PlanningStatus } from "@office/types";

export const PLANNING_STATUS_LABEL: Record<PlanningStatus, string> = {
  draft: "Draft",
  active: "Active",
  done: "Done",
  cancelled: "Cancelled",
};
