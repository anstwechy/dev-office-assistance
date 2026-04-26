import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { TriageItemDto } from "@office/types";
import { useApi } from "../useApi";
import { PageHeader } from "../components/PageHeader";
import { DataTableSkeleton } from "../components/skeletons/AppSkeletons";

export function PriorityPage() {
  const { request } = useApi();

  const q = useQuery({
    queryKey: ["triage-priority"],
    queryFn: async () => {
      const res = await request("/api/triage-items/priority-queue");
      if (!res.ok) throw new Error("load_failed");
      return (await res.json()) as { items: TriageItemDto[] };
    },
  });

  const items = q.data?.items ?? [];

  return (
    <div className="app-page app-page--priority">
      <PageHeader
        eyebrow="Ops"
        title="Blockers, risk & escalations"
        lead="Open items that are blocker or risk, plus anything marked escalated. Age is days since the item was created."
        actions={
          <Link to="/triage/new" className="btn btn-primary">
            New triage
          </Link>
        }
      />

      <section className="card" aria-label="Priority queue">
        <div className="card__head">
          <h2 className="card__title">Queue</h2>
          <p className="card__sub" style={{ margin: 0 }}>
            {q.data ? `${items.length} open` : "Loading…"}
          </p>
        </div>
        {q.isLoading && (
          <DataTableSkeleton
            columns={6}
            columnLabels={["Title", "Category", "Age (days)", "Status", "Assignee", "Flags"]}
            tableLabel="Loading priority queue"
          />
        )}
        {q.isError && (
          <p role="alert" style={{ margin: 0 }}>
            Could not load the priority queue.
          </p>
        )}
        {q.data && (
          <div className="data-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Age</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} data-escalated={it.escalated || undefined}>
                    <td>
                      <Link to={`/triage/${it.id}`}>{it.title}</Link>
                      {it.program && (
                        <div className="preview-line" title="Program">
                          {it.program}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="pill pill--cat" data-category={it.category}>
                        {it.category}
                      </span>
                    </td>
                    <td className="muted">
                      {it.ageDays !== undefined ? `${it.ageDays}d` : "—"}
                    </td>
                    <td>
                      <span className="pill pill--status" data-status={it.status}>
                        {it.status}
                      </span>
                    </td>
                    <td className="muted">{it.assigneeName ?? "—"}</td>
                    <td>
                      {it.escalated && (
                        <span className="badge badge--warn" style={{ marginRight: 4 }}>
                          Escalated
                        </span>
                      )}
                      {it.sourceType && it.sourceType !== "manual" && (
                        <span className="muted">{it.sourceType}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && (
              <div className="empty-state" role="status" style={{ margin: "0.75rem" }}>
                <strong>Nothing in the priority queue</strong>
                When you add blockers, risks, or mark items as escalated, they land here.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
