import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlanningItemDto, PlanningStatus } from "@office/types";
import { PLANNING_STATUSES } from "@office/types";
import { DEV_DEPARTMENT_SUGGESTIONS } from "../../constants/departments";
import { useApi } from "../../useApi";
import { FormModal } from "../modals/FormModal";

export type PlanningInitiativeModalProps = {
  opened: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  itemId: string | null;
};

export function PlanningInitiativeModal({ opened, onClose, mode, itemId }: PlanningInitiativeModalProps) {
  const uid = useId();
  const f = `plan-mod-${uid}`;
  const { request } = useApi();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("");
  const [program, setProgram] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [itemStatus, setItemStatus] = useState<PlanningStatus>("draft");
  const [linkTriageId, setLinkTriageId] = useState("");

  const itemQuery = useQuery({
    queryKey: ["planning-item", itemId],
    enabled: opened && mode === "edit" && Boolean(itemId),
    queryFn: async () => {
      const res = await request(`/api/planning/${itemId}`);
      if (!res.ok) throw new Error("load_failed");
      return (await res.json()) as PlanningItemDto;
    },
  });

  const p = itemQuery.data;

  useEffect(() => {
    if (!opened) return;
    if (mode === "create") {
      setTitle("");
      setDescription("");
      setDepartment("");
      setProgram("");
      setTargetDate("");
      setItemStatus("draft");
      setLinkTriageId("");
      return;
    }
    if (mode === "edit" && p) {
      setTitle(p.title);
      setDescription(p.description ?? "");
      setDepartment(p.department ?? "");
      setProgram(p.program ?? "");
      setTargetDate(p.targetDate ? p.targetDate.slice(0, 10) : "");
      setItemStatus(p.status);
      setLinkTriageId("");
    }
  }, [opened, mode, p, itemId]);

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await request("/api/planning", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          department: department.trim() || null,
          program: program.trim() || null,
          targetDate: targetDate ? new Date(targetDate).toISOString() : null,
          status: itemStatus,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "create_failed");
      }
      return (await res.json()) as PlanningItemDto;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["planning"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
      onClose();
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await request(`/api/planning/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          department: department.trim() || null,
          program: program.trim() || null,
          targetDate: targetDate ? new Date(targetDate).toISOString() : null,
          status: itemStatus,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "save_failed");
      }
      return (await res.json()) as PlanningItemDto;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["planning-item", itemId] });
      await qc.invalidateQueries({ queryKey: ["planning"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
      onClose();
    },
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const res = await request(`/api/planning/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["planning"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
      onClose();
    },
  });

  const linkMut = useMutation({
    mutationFn: async (triageItemId: string) => {
      const res = await request(`/api/planning/${itemId}/triage-links`, {
        method: "POST",
        body: JSON.stringify({ triageItemId }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "link_failed");
      }
    },
    onSuccess: async () => {
      setLinkTriageId("");
      await qc.invalidateQueries({ queryKey: ["planning-item", itemId] });
      await qc.invalidateQueries({ queryKey: ["planning"] });
    },
  });

  const unlinkMut = useMutation({
    mutationFn: async (triageItemId: string) => {
      const res = await request(`/api/planning/${itemId}/triage-links/${triageItemId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("unlink_failed");
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["planning-item", itemId] });
      await qc.invalidateQueries({ queryKey: ["planning"] });
    },
  });

  const busy =
    createMut.isPending || saveMut.isPending || deleteMut.isPending || linkMut.isPending || unlinkMut.isPending;
  const ready = mode === "create" || (mode === "edit" && p && !itemQuery.isLoading);
  const err = mode === "create" ? createMut.isError : saveMut.isError;
  const errMsg = (mode === "create" ? createMut.error : saveMut.error) as Error | undefined;

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={mode === "create" ? "Add initiative" : "Edit initiative"}
      size="lg"
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
    >
      {mode === "edit" && itemQuery.isLoading && <p className="muted">Loading…</p>}
      {mode === "edit" && itemQuery.isError && <p role="alert">Could not load this item.</p>}
      {ready && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "create") {
              createMut.mutate();
            } else {
              saveMut.mutate();
            }
          }}
        >
          <div className="field">
            <label htmlFor={`${f}-t`}>Title</label>
            <input
              id={`${f}-t`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor={`${f}-d`}>Description</label>
            <textarea
              id={`${f}-d`}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="toolbar" style={{ alignItems: "flex-end" }}>
            <div>
              <label htmlFor={`${f}-dept`}>Department (optional)</label>
              <input
                id={`${f}-dept`}
                list={`${f}-dept-dl`}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={busy}
                placeholder="e.g. All departments, Mobile, Web…"
                autoComplete="off"
              />
              <datalist id={`${f}-dept-dl`}>
                {DEV_DEPARTMENT_SUGGESTIONS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor={`${f}-prg`}>Program (optional)</label>
              <input
                id={`${f}-prg`}
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                disabled={busy}
                placeholder="e.g. Bank client or program"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor={`${f}-dt`}>Target date</label>
              <input
                id={`${f}-dt`}
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <label htmlFor={`${f}-st`}>Status</label>
              <select
                id={`${f}-st`}
                value={itemStatus}
                onChange={(e) => setItemStatus(e.target.value as PlanningStatus)}
                disabled={busy}
              >
                {PLANNING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {err && <p role="alert">{errMsg?.message}</p>}
          {mode === "edit" && p?.linkedTriage && p.linkedTriage.length > 0 && (
            <div className="field" style={{ marginTop: "0.5rem" }}>
              <span style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--color-muted, #666)" }}>
                Linked triage
              </span>
              <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {p.linkedTriage.map((t) => (
                  <li key={t.id} style={{ marginBottom: "0.25rem" }}>
                    <Link to={`/triage/${t.id}`} onClick={onClose}>
                      {t.title}
                    </Link>{" "}
                    <span className="muted" style={{ fontSize: "0.85rem" }}>
                      {t.status}
                    </span>{" "}
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ fontSize: "0.82rem", padding: "0.1rem 0.35rem" }}
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm("Remove this link?")) {
                          unlinkMut.mutate(t.id);
                        }
                      }}
                    >
                      Unlink
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {mode === "edit" && itemId && (
            <div className="field">
              <label htmlFor={`${f}-link`}>Link a triage item by id</label>
              <div className="toolbar" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
                <input
                  id={`${f}-link`}
                  value={linkTriageId}
                  onChange={(e) => setLinkTriageId(e.target.value)}
                  placeholder="Paste triage item UUID"
                  autoComplete="off"
                  disabled={busy}
                />
                <button
                  type="button"
                  className="primary"
                  disabled={busy || !linkTriageId.trim()}
                  onClick={() => {
                    linkMut.mutate(linkTriageId.trim());
                  }}
                >
                  {linkMut.isPending ? "Linking…" : "Link"}
                </button>
              </div>
              {linkMut.isError && <p role="alert">{(linkMut.error as Error).message}</p>}
            </div>
          )}
          <div className="form-actions">
            <button type="submit" className="primary" disabled={busy}>
              {mode === "create" ? (createMut.isPending ? "Adding…" : "Add") : saveMut.isPending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            {mode === "edit" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Delete this planning item?")) {
                    deleteMut.mutate();
                  }
                }}
              >
                Delete
              </button>
            )}
          </div>
        </form>
      )}
    </FormModal>
  );
}
