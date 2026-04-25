import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDisclosure } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlanningItemDto, PlanningStatus } from "@office/types";
import { PLANNING_STATUSES } from "@office/types";
import { useApi } from "../useApi";
import { PageHeader } from "../components/PageHeader";
import { DataTableSkeleton } from "../components/skeletons/AppSkeletons";
import { PlanningKanbanBoard } from "../components/planning/PlanningKanbanBoard";
import { PLANNING_STATUS_LABEL } from "../constants/planningLabels";
import { PlanningInitiativeModal } from "../components/planning/PlanningInitiativeModal";
import { DEV_DEPARTMENT_SUGGESTIONS } from "../constants/departments";
import "../components/planning/planning-board.css";

type ViewMode = "board" | "table";

export function PlanningPage() {
  const { request } = useApi();
  const qc = useQueryClient();
  const boardLiveId = useId();
  const [statusFilter, setStatusFilter] = useState<PlanningStatus | "">("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [liveBoardMsg, setLiveBoardMsg] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();
  const planningEdit = searchParams.get("edit");
  const [planningModalMode, setPlanningModalMode] = useState<"create" | "edit">("create");
  const [planningModalOpened, { open: openPlanningModal, close: closePlanningModal }] = useDisclosure(false);

  const listQuery = useQuery({
    queryKey: ["planning"],
    queryFn: async () => {
      const res = await request("/api/planning");
      if (!res.ok) throw new Error("list_failed");
      return (await res.json()) as { items: PlanningItemDto[] };
    },
  });

  const items = listQuery.data?.items ?? [];

  const itemsAfterDepartment = useMemo(() => {
    if (!departmentFilter.trim()) return items;
    const want = departmentFilter.trim();
    return items.filter((i) => (i.department?.trim() || "") === want);
  }, [items, departmentFilter]);

  const filteredForTable = useMemo(() => {
    if (!statusFilter) return itemsAfterDepartment;
    return itemsAfterDepartment.filter((i) => i.status === statusFilter);
  }, [itemsAfterDepartment, statusFilter]);

  const announceBoard = useCallback((message: string) => {
    setLiveBoardMsg(message);
  }, []);

  useEffect(() => {
    if (!liveBoardMsg) return;
    const t = window.setTimeout(() => setLiveBoardMsg(""), 4000);
    return () => window.clearTimeout(t);
  }, [liveBoardMsg]);

  useEffect(() => {
    if (planningEdit) {
      setPlanningModalMode("edit");
      openPlanningModal();
    }
  }, [planningEdit, openPlanningModal]);

  const closePlanningInitiativeModal = () => {
    closePlanningModal();
    setSearchParams((p) => {
      p.delete("edit");
      return p;
    });
  };

  const openCreateInitiative = () => {
    setPlanningModalMode("create");
    setSearchParams((p) => {
      p.delete("edit");
      return p;
    });
    openPlanningModal();
  };

  const moveStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PlanningStatus }) => {
      const res = await request(`/api/planning/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "status_update_failed");
      }
      return (await res.json()) as PlanningItemDto;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["planning"] });
      const previous = qc.getQueryData<{ items: PlanningItemDto[] }>(["planning"]);
      if (previous) {
        qc.setQueryData(["planning"], {
          items: previous.items.map((row) => (row.id === id ? { ...row, status } : row)),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["planning"], ctx.previous);
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ["planning"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
    },
  });

  const boardSkeleton = (
    <div className="planning-board-wrap" aria-busy="true">
      <div className="planning-board">
        {PLANNING_STATUSES.map((s) => (
          <div key={s} className={`planning-column planning-column--status-${s}`}>
            <div className="planning-column__head">
              <h3 className="planning-column__title">{PLANNING_STATUS_LABEL[s]}</h3>
              <span className="planning-column__count">…</span>
            </div>
            <div className="planning-column__body">
              <p className="planning-column__empty">Loading…</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Roadmap"
        title="Dev planning"
        lead="Roadmap and initiatives by area: what we are building next, when we aim to ship, and current status. Separate from day-to-day triage items."
      />

      <p className="planning-view-hint">
        On the board, drag a card (anywhere on the card, or the grip) to change status; follow the link on the right to
        open details. Switch to the table for a compact scan or printing.
      </p>

      <div id={boardLiveId} className="planning-board-live" aria-live="polite">
        {liveBoardMsg}
      </div>

      <section className="card">
        <div className="card__head">
          <h2 className="card__title">View &amp; filter</h2>
        </div>
        <div className="toolbar" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="planning-view-toggle" role="group" aria-label="Planning view">
            <button
              type="button"
              aria-pressed={viewMode === "board"}
              onClick={() => setViewMode("board")}
            >
              Board
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "table"}
              onClick={() => setViewMode("table")}
            >
              Table
            </button>
          </div>
          <div className="field" style={{ maxWidth: "16rem", marginBottom: 0 }}>
            <label htmlFor="pf">Status filter</label>
            <select
              id="pf"
              value={statusFilter}
              onChange={(e) => {
                const v = e.target.value;
                setStatusFilter(v === "" ? "" : (v as PlanningStatus));
              }}
            >
              <option value="">All statuses</option>
              {PLANNING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PLANNING_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ maxWidth: "16rem", marginBottom: 0 }}>
            <label htmlFor="pdept">Area filter</label>
            <select
              id="pdept"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="">All areas</option>
              {DEV_DEPARTMENT_SUGGESTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
        {statusFilter || departmentFilter ? (
          <p className="preview-line" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
            {[
              statusFilter && `status: ${PLANNING_STATUS_LABEL[statusFilter]}`,
              departmentFilter && `area: ${departmentFilter}`,
            ]
              .filter(Boolean)
              .join(" · ")}
            . Clear the filters to see the full list.
          </p>
        ) : null}
        <div className="form-actions" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
          <button type="button" className="primary" onClick={openCreateInitiative}>
            Add initiative
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card__head">
          <h2 className="card__title">{viewMode === "board" ? "Initiative board" : "Initiatives"}</h2>
        </div>
        {moveStatusMut.isError && (
          <p role="alert" style={{ margin: "0 0 0.75rem" }}>
            Could not update status. {(moveStatusMut.error as Error).message}
          </p>
        )}
        {listQuery.isLoading && viewMode === "board" && boardSkeleton}
        {listQuery.isLoading && viewMode === "table" && (
          <DataTableSkeleton
            columns={6}
            columnLabels={["Target", "Title", "Status", "Area", "Program", ""]}
            tableLabel="Loading planning list"
          />
        )}
        {listQuery.isError && <p role="alert">Could not load planning items.</p>}
        {listQuery.data && viewMode === "board" && (
          <PlanningKanbanBoard
            items={itemsAfterDepartment}
            statusFilter={statusFilter}
            disabled={moveStatusMut.isPending}
            announce={announceBoard}
            onMove={(id, nextStatus) => moveStatusMut.mutate({ id, status: nextStatus })}
          />
        )}
        {listQuery.data && viewMode === "table" && (
          <div className="data-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Area</th>
                  <th>Program</th>
                  <th> </th>
                </tr>
              </thead>
              <tbody>
                {filteredForTable.map((p) => (
                  <tr key={p.id}>
                    <td className="muted">{p.targetDate ? p.targetDate.slice(0, 10) : "—"}</td>
                    <td>
                      <Link
                        to={{ pathname: "/planning", search: new URLSearchParams({ edit: p.id }).toString() }}
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td>
                      <span className="badge">{p.status}</span>
                    </td>
                    <td className="muted">{p.department ?? "—"}</td>
                    <td className="muted">{p.program?.trim() ? p.program : "—"}</td>
                    <td>
                      <Link
                        to={{ pathname: "/planning", search: new URLSearchParams({ edit: p.id }).toString() }}
                        className="link-out"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredForTable.length === 0 && (
              <div className="empty-state" role="status" style={{ margin: "0.75rem" }}>
                <strong>No initiatives match</strong>
                Add one with &quot;Add initiative&quot; above, or change the status / area filters.
              </div>
            )}
          </div>
        )}
      </section>
      <PlanningInitiativeModal
        opened={planningModalOpened}
        onClose={closePlanningInitiativeModal}
        mode={planningModalMode}
        itemId={planningModalMode === "edit" && planningEdit ? planningEdit : null}
      />
    </div>
  );
}
