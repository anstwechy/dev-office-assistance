import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TriageCategory, TriageStatus } from "@office/types";
import { useApi } from "../useApi";
import { PageHeader } from "../components/PageHeader";

export function TriageCreatePage() {
  const { request, uploadTriageAttachment } = useApi();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const developersQuery = useQuery({
    queryKey: ["developers"],
    queryFn: async () => {
      const res = await request("/api/developers");
      if (!res.ok) throw new Error("developers_failed");
      return (await res.json()) as {
        developers: Array<{ id: string; displayName: string }>;
      };
    },
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TriageCategory>("other");
  const [status, setStatus] = useState<TriageStatus>("inbox");
  const [nextAction, setNextAction] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assigneeDeveloperId, setAssigneeDeveloperId] = useState("");
  const [program, setProgram] = useState("");
  const [escalated, setEscalated] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await request("/api/triage-items", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || null,
          category,
          status,
          nextAction: nextAction || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          assigneeDeveloperId,
          program: program.trim() || null,
          escalated,
          sourceType: "manual",
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || "create_failed");
      }
      return (await res.json()) as { id: string };
    },
    onSuccess: async (data) => {
      const failed: string[] = [];
      for (const f of files) {
        const up = await uploadTriageAttachment(data.id, f);
        if (!up.ok) {
          failed.push(f.name);
        }
      }
      if (failed.length) {
        window.alert(
          `Item saved. These files could not be uploaded (try again on the item page): ${failed.join(
            ", ",
          )}`,
        );
      }
      await qc.invalidateQueries({ queryKey: ["triage-items"] });
      await qc.invalidateQueries({ queryKey: ["triage-summary"] });
      await qc.invalidateQueries({ queryKey: ["triage-item", data.id] });
      navigate(`/triage/${data.id}`);
    },
  });

  const developers = developersQuery.data?.developers ?? [];

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Triage"
        title="New triage item"
        lead="Capture a new issue or follow-up. You can attach PDFs, images, audio, and common office files after the item is created (or add more from the item page)."
      />
      <div className="card">
        <div className="card__head">
          <h2 className="card__title">Details</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="desc">Description</label>
            <textarea
              id="desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="cat">Category</label>
            <select
              id="cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as TriageCategory)}
            >
              <option value="blocker">blocker</option>
              <option value="risk">risk</option>
              <option value="quality">quality</option>
              <option value="process">process</option>
              <option value="other">other</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="st">Status</label>
            <select
              id="st"
              value={status}
              onChange={(e) => setStatus(e.target.value as TriageStatus)}
            >
              <option value="inbox">inbox</option>
              <option value="in_progress">in_progress</option>
              <option value="snoozed">snoozed</option>
              <option value="done">done</option>
              <option value="dropped">dropped</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="na">Next action</label>
            <input
              id="na"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="due">Due (date/time)</label>
            <input
              id="due"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="program">Program / client (optional)</label>
            <input
              id="program"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              placeholder="e.g. Bank A mobile program"
            />
          </div>
          <div className="field field--row">
            <input
              id="escalated"
              type="checkbox"
              checked={escalated}
              onChange={(e) => setEscalated(e.target.checked)}
            />
            <label htmlFor="escalated" style={{ margin: 0, fontWeight: 600 }}>
              Escalate to priority queue
            </label>
          </div>
          <div className="field">
            <label htmlFor="as">Assignee</label>
            <select
              id="as"
              required
              value={assigneeDeveloperId}
              onChange={(e) => setAssigneeDeveloperId(e.target.value)}
            >
              <option value="">Select…</option>
              {developers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="att">Attachments (optional)</label>
            <input
              id="att"
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
              {files.length
                ? `${files.length} file(s) selected — they upload when you create the item.`
                : "Images, PDF, audio, Office docs, zip — max size per file is enforced by the server."}
            </p>
          </div>
          {createMut.isError && <p role="alert">{(createMut.error as Error).message}</p>}
          <div className="form-actions">
            <button type="submit" className="primary" disabled={createMut.isPending}>
              {createMut.isPending ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
