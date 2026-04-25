import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { DashboardOverviewDto, TriageItemDto, TriageSummaryDto } from "@office/types";
import { DEV_TEAMS } from "@office/types";
import { DEV_TEAM_LABELS } from "../constants/teams";
import { useApi } from "../useApi";
import { PageHeader } from "../components/PageHeader";
import { AssigneeWorkloadBlock } from "../components/dashboard/AssigneeWorkloadBlock";
import {
  MetricStripSkeleton,
  ProfileLineSkeleton,
  SnapshotGridSkeleton,
  DataTableSkeleton,
} from "../components/skeletons/AppSkeletons";

function formatMoney(amountStr: string, currency: string) {
  const n = Number(amountStr);
  if (Number.isNaN(n)) return amountStr;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

type Me = { id: string; email: string | null; displayName: string | null };

function userInitials(u: Me) {
  const s = (u.displayName ?? u.email ?? "U").trim();
  const p = s.split(/\s+/);
  if (p.length >= 2) {
    return (p[0]![0]! + p[1]![0]!).toUpperCase();
  }
  return s.slice(0, 2).toUpperCase();
}

export function DashboardPage() {
  const { request } = useApi();
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [assignee, setAssignee] = useState("");
  const [preset, setPreset] = useState<"" | "overdue" | "thisWeek">("");

  const activeFilterCount = useMemo(
    () => [preset, status, category, assignee].filter(Boolean).length,
    [preset, status, category, assignee],
  );

  const listUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (category) p.set("category", category);
    if (assignee) p.set("assigneeDeveloperId", assignee);
    if (preset === "overdue") p.set("overdue", "true");
    if (preset === "thisWeek") p.set("thisWeek", "true");
    const qs = p.toString();
    return `/api/triage-items${qs ? `?${qs}` : ""}`;
  }, [status, category, assignee, preset]);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await request("/api/me");
      if (!res.ok) throw new Error("me_failed");
      return (await res.json()) as Me;
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["triage-summary"],
    queryFn: async () => {
      const res = await request("/api/triage-items/summary");
      if (!res.ok) throw new Error("summary_failed");
      return (await res.json()) as TriageSummaryDto;
    },
  });

  const overviewQuery = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: async () => {
      const res = await request("/api/dashboard-overview");
      if (!res.ok) throw new Error("overview_failed");
      return (await res.json()) as DashboardOverviewDto;
    },
  });

  const developersQuery = useQuery({
    queryKey: ["developers"],
    queryFn: async () => {
      const res = await request("/api/developers");
      if (!res.ok) throw new Error("developers_failed");
      return (await res.json()) as {
        developers: Array<{ id: string; displayName: string; skills: string | null }>;
      };
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["triage-items", listUrl],
    queryFn: async () => {
      const res = await request(listUrl);
      if (!res.ok) throw new Error("list_failed");
      return (await res.json()) as { items: TriageItemDto[] };
    },
  });

  const developers = developersQuery.data?.developers ?? [];
  const sum = summaryQuery.data;

  const developerById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of developers) {
      m.set(d.id, d.displayName);
    }
    return m;
  }, [developers]);

  return (
    <div className="app-page app-page--dashboard">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        lead="Queue health, org snapshot, and triage in one place."
        actions={
          <div className="dashboard-header-actions">
            <nav className="dashboard-quick-nav" aria-label="Work areas">
              <Link to="/priority" className="btn btn-ghost">
                Priority
              </Link>
              <Link to="/standup" className="btn btn-ghost">
                Check-in
              </Link>
              <Link to="/decisions" className="btn btn-ghost">
                Decisions
              </Link>
              <Link to="/planning" className="btn btn-ghost">
                Planning
              </Link>
              <Link to="/expenses" className="btn btn-ghost">
                Expenses
              </Link>
              <Link to="/team-management" className="btn btn-ghost">
                Team
              </Link>
            </nav>
            <Link to="/triage/new" className="btn btn-primary">
              New item
            </Link>
          </div>
        }
      />

      <section className="card dashboard-overview-card" aria-label="Workspace overview">
        <div className="card__head card__head--row">
          <div>
            <h2 className="card__title">At a glance</h2>
            <p className="card__sub">
              Triage counts are live. Expense totals use{" "}
              <strong>{overviewQuery.data?.periodLabel ?? "this month"}</strong> (logged entries only).
            </p>
          </div>
        </div>

        <div className="dashboard-bento">
          <div className="dashboard-bento__pulse" aria-label="Triage queue">
            {meQuery.isLoading && <ProfileLineSkeleton />}
            {meQuery.data && (
              <div className="dashboard-identity">
                <span className="dashboard-identity__ava" aria-hidden="true">
                  {userInitials(meQuery.data)}
                </span>
                <div className="dashboard-identity__meta">
                  <span className="dashboard-identity__label">Signed in</span>
                  <span className="dashboard-identity__name">
                    {meQuery.data.displayName ?? meQuery.data.email ?? meQuery.data.id}
                  </span>
                </div>
              </div>
            )}
            <div className="dashboard-bento__metrics">
              {summaryQuery.isLoading && <MetricStripSkeleton count={5} />}
              {sum && (
                <div className="metric-strip metric-strip--dashboard">
                  <div
                    className="metric metric--compact"
                    data-metric-priority={sum.overdueCount > 0 ? "high" : undefined}
                  >
                    <span className="metric-value">{sum.overdueCount}</span>
                    <span className="metric-label">Overdue</span>
                  </div>
                  <div className="metric metric--compact">
                    <span className="metric-value">{sum.dueThisWeekCount}</span>
                    <span className="metric-label">Due this week</span>
                  </div>
                  <div className="metric metric--compact">
                    <span className="metric-value">{sum.byStatus.inbox}</span>
                    <span className="metric-label">Inbox</span>
                  </div>
                  <div className="metric metric--compact">
                    <span className="metric-value">{sum.byStatus.in_progress}</span>
                    <span className="metric-label">In progress</span>
                  </div>
                  <div className="metric metric--compact">
                    <span className="metric-value">{sum.byStatus.snoozed}</span>
                    <span className="metric-label">Snoozed</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {overviewQuery.isLoading && <SnapshotGridSkeleton />}
          {overviewQuery.isError && (
            <p className="dashboard-error" role="alert">
              Could not load expenses, planning, or team stats.
            </p>
          )}
          {overviewQuery.data && (
            <div className="dashboard-snapshot-compact" aria-label="Expenses, planning, and team">
              <div className="snapshot-block snapshot-block--dashboard">
                <h3 className="snapshot-block__title">
                  <Link to="/expenses">Expenses</Link>
                </h3>
                <div className="metric-strip metric-strip--dashboard">
                  {overviewQuery.data.expenses.byCurrency.length === 0 ? (
                    <div className="metric metric--compact">
                      <span className="metric-value">{formatMoney("0", "USD")}</span>
                      <span className="metric-label">Logged (USD)</span>
                    </div>
                  ) : (
                    overviewQuery.data.expenses.byCurrency.map((row) => (
                      <div className="metric metric--compact" key={row.currency}>
                        <span className="metric-value">{formatMoney(row.total, row.currency)}</span>
                        <span className="metric-label">Total {row.currency}</span>
                      </div>
                    ))
                  )}
                  <div className="metric metric--compact">
                    <span className="metric-value">{overviewQuery.data.expenses.monthEntryCount}</span>
                    <span className="metric-label">Entries</span>
                  </div>
                  <div className="metric metric--compact">
                    <span className="metric-value">{overviewQuery.data.expenses.withReceiptCount}</span>
                    <span className="metric-label">Receipts</span>
                  </div>
                </div>
              </div>
              <div className="snapshot-block snapshot-block--dashboard">
                <h3 className="snapshot-block__title">
                  <Link to="/planning">Planning</Link>
                </h3>
                <div className="metric-strip metric-strip--dashboard">
                  <div className="metric metric--compact">
                    <span className="metric-value">{overviewQuery.data.planning.active}</span>
                    <span className="metric-label">Active</span>
                  </div>
                  <div className="metric metric--compact">
                    <span className="metric-value">{overviewQuery.data.planning.draft}</span>
                    <span className="metric-label">Draft</span>
                  </div>
                  <div className="metric metric--compact">
                    <span className="metric-value">
                      {overviewQuery.data.planning.byStatus.done}
                    </span>
                    <span className="metric-label">Done</span>
                  </div>
                </div>
              </div>
              <div className="snapshot-block snapshot-block--dashboard">
                <h3 className="snapshot-block__title">
                  <Link to="/priority">Blockers &amp; risk</Link>
                </h3>
                <div className="metric-strip metric-strip--dashboard">
                  <div
                    className="metric metric--compact"
                    data-metric-priority={overviewQuery.data.ops.openBlockerRisk > 0 ? "high" : undefined}
                  >
                    <span className="metric-value">{overviewQuery.data.ops.openBlockerRisk}</span>
                    <span className="metric-label">Open</span>
                  </div>
                  <div
                    className="metric metric--compact"
                    data-metric-priority={overviewQuery.data.ops.escalatedOpen > 0 ? "high" : undefined}
                  >
                    <span className="metric-value">{overviewQuery.data.ops.escalatedOpen}</span>
                    <span className="metric-label">Escalated</span>
                  </div>
                </div>
                <p className="preview-line" style={{ margin: "0.5rem 0 0" }}>
                  <Link to="/priority" className="link-out">
                    Open priority queue
                  </Link>
                </p>
              </div>
              <div className="snapshot-block snapshot-block--dashboard snapshot-block--wide">
                <h3 className="snapshot-block__title">
                  <Link to="/developers">Assignee load</Link>
                </h3>
                <AssigneeWorkloadBlock rows={overviewQuery.data.workload.rows} />
              </div>
              <div className="snapshot-block snapshot-block--dashboard snapshot-block--wide">
                <h3 className="snapshot-block__title">
                  <Link to="/team-management">Roster by team</Link>
                </h3>
                <div className="metric-strip metric-strip--dashboard">
                  <div className="metric metric--compact">
                    <span className="metric-value">{overviewQuery.data.teams.uniqueDevelopers}</span>
                    <span className="metric-label">People</span>
                  </div>
                  <div className="metric metric--compact">
                    <span className="metric-value">{overviewQuery.data.teams.totalMemberships}</span>
                    <span className="metric-label">Assignments</span>
                  </div>
                </div>
                <ul className="team-snapshot-list team-snapshot-list--inline">
                  {DEV_TEAMS.map((t) => (
                    <li key={t}>
                      <span className="team-snapshot-list__name">{DEV_TEAM_LABELS[t]}</span>
                      <span className="team-snapshot-list__n">
                        {overviewQuery.data.teams.byTeam[t]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="card dashboard-triage-card" aria-label="Triage list and filters">
        <div className="card__head card__head--row">
          <div>
            <h2 className="card__title">Triage</h2>
            <p className="card__sub">
              {itemsQuery.data
                ? `${itemsQuery.data.items.length} item${itemsQuery.data.items.length === 1 ? "" : "s"} match filters`
                : "Filter the queue, then open a row for detail."}
            </p>
          </div>
        </div>

        <details className="dashboard-triage-filters-wrap">
          <summary className="dashboard-triage-filters__summary">
            <span className="dashboard-triage-filters__summary-left">
              <span className="dashboard-triage-filters__summary-title" id="triage-filters-legend">
                Triage filters
              </span>
              {activeFilterCount > 0 && (
                <span className="dashboard-triage-filters__summary-badge" aria-label={`${activeFilterCount} filter(s) active`}>
                  {activeFilterCount} active
                </span>
              )}
            </span>
          </summary>
          <div
            className="dashboard-triage-filters"
            role="search"
            aria-label="Triage filters"
            aria-labelledby="triage-filters-legend"
          >
            <div className="toolbar dashboard-toolbar--presets">
              <span className="dashboard-filter-label" id="dash-presets-lbl">
                Quick
              </span>
              <button
                type="button"
                className={preset === "overdue" ? "primary" : undefined}
                aria-pressed={preset === "overdue"}
                onClick={() => setPreset((p) => (p === "overdue" ? "" : "overdue"))}
              >
                Overdue
              </button>
              <button
                type="button"
                className={preset === "thisWeek" ? "primary" : undefined}
                aria-pressed={preset === "thisWeek"}
                onClick={() => setPreset((p) => (p === "thisWeek" ? "" : "thisWeek"))}
              >
                Due this week
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreset("");
                  setStatus("");
                  setCategory("");
                  setAssignee("");
                }}
              >
                Clear
              </button>
            </div>
            <div className="dashboard-toolbar--fields">
              <div className="dashboard-field">
                <label htmlFor="f-status">Status</label>
                <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">Any</option>
                  <option value="inbox">inbox</option>
                  <option value="in_progress">in_progress</option>
                  <option value="snoozed">snoozed</option>
                  <option value="done">done</option>
                  <option value="dropped">dropped</option>
                </select>
              </div>
              <div className="dashboard-field">
                <label htmlFor="f-cat">Category</label>
                <select id="f-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Any</option>
                  <option value="blocker">blocker</option>
                  <option value="risk">risk</option>
                  <option value="quality">quality</option>
                  <option value="process">process</option>
                  <option value="other">other</option>
                </select>
              </div>
              <div className="dashboard-field">
                <label htmlFor="f-assignee">Assignee</label>
                <select
                  id="f-assignee"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">Any</option>
                  {developers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.displayName || d.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </details>

        {itemsQuery.isLoading && (
          <DataTableSkeleton
            columns={8}
            columnLabels={["Title", "Status", "Category", "Program", "Files", "Assignee", "Due", "Source"]}
            tableLabel="Loading triage items"
          />
        )}
        {itemsQuery.isError && (
          <p role="alert">Could not load items. Try signing in again if your session expired.</p>
        )}
        {itemsQuery.data && (
          <div className="data-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Category</th>
                  <th>Program</th>
                  <th>Files</th>
                  <th>Assignee</th>
                  <th>Due</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {itemsQuery.data.items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <Link to={`/triage/${it.id}`}>{it.title}</Link>
                      {it.sourcePreview && <div className="preview-line">{it.sourcePreview}</div>}
                    </td>
                    <td>
                      <span
                        className="pill pill--status"
                        data-status={it.status}
                      >
                        {it.status}
                      </span>
                    </td>
                    <td>
                      <span
                        className="pill pill--cat"
                        data-category={it.category}
                      >
                        {it.category}
                      </span>
                    </td>
                    <td className="muted">{it.program?.trim() ? it.program : "—"}</td>
                    <td className="muted">{it.attachmentCount ?? 0}</td>
                    <td className="muted">
                      {it.assigneeName ?? developerById.get(it.assigneeDeveloperId) ?? "—"}
                    </td>
                    <td>{it.dueAt ? it.dueAt.slice(0, 10) : "—"}</td>
                    <td>
                      <span className="muted">
                        {it.sourceType === "microsoft_todo"
                          ? "To Do"
                          : it.sourceType === "outlook"
                            ? "Outlook"
                            : it.sourceType}
                      </span>
                      {it.graphWebLink && (
                        <>
                          {" "}
                          <a
                            className="link-out"
                            href={it.graphWebLink}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                          </a>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {itemsQuery.data.items.length === 0 && (
              <div className="empty-state" role="status">
                <strong>No matching items</strong>
                Try clearing filters or changing the assignee. Create a new item from the header
                when you are ready.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
