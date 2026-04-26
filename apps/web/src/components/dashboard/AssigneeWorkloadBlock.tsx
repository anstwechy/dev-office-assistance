import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { DashboardOverviewDto } from "@office/types";

type Row = DashboardOverviewDto["workload"]["rows"][number];

function initials(displayName: string) {
  const s = displayName.trim();
  const p = s.split(/\s+/).filter(Boolean);
  if (p.length >= 2) {
    return (p[0]![0]! + p[1]![0]! || "").toUpperCase();
  }
  return s.slice(0, 2).toUpperCase() || "?";
}

type Props = {
  rows: Row[];
};

/**
 * Triage “assignee load” as a scannable bar chart: open vs in progress per person,
 * load sorted by busyness. Easier to read than a wall of text badges.
 */
export function AssigneeWorkloadBlock({ rows }: Props) {
  const { sorted, maxLoad } = useMemo(() => {
    const ordered = [...rows].sort(
      (a, b) => b.open + b.inProgress - (a.open + a.inProgress),
    );
    const max = Math.max(0, ...ordered.map((r) => r.open + r.inProgress));
    const maxLoad = max > 0 ? max : 1;
    return { sorted: ordered, maxLoad };
  }, [rows]);

  const allZero = sorted.length > 0 && sorted.every((r) => r.open === 0 && r.inProgress === 0);

  if (rows.length === 0) {
    return (
      <p className="assignee-wl__empty" role="status">
        No assignee workload data yet. When triage items are assigned, you will see a chart here.
      </p>
    );
  }

  return (
    <div className="assignee-wl">
      {allZero && (
        <p className="assignee-wl__hint" role="status">
          Everyone is at zero open and in progress — queue is quiet.
        </p>
      )}
      <div className="assignee-wl__legend" aria-hidden="true">
        <span>
          <span className="assignee-wl__key assignee-wl__key--open" /> Inbox
        </span>
        <span>
          <span className="assignee-wl__key assignee-wl__key--ip" /> In progress
        </span>
      </div>
      <ul className="assignee-wl__list" aria-label="Triage count per assignee, sorted by load">
        {sorted.map((r) => {
          const total = r.open + r.inProgress;
          const widthPct = (total / maxLoad) * 100;
          return (
            <li key={r.developerId} className="assignee-wl__row">
              <div className="assignee-wl__who">
                <span className="assignee-wl__ava" aria-hidden>
                  {initials(r.displayName)}
                </span>
                <span className="assignee-wl__name" dir="auto" title={r.displayName}>
                  {r.displayName}
                </span>
              </div>
              <div
                className="assignee-wl__bar-wrap"
                role="img"
                aria-label={`${r.displayName}: ${r.open} inbox, ${r.inProgress} in progress`}
              >
                <div className="assignee-wl__track" aria-hidden>
                  <div className="assignee-wl__fill" style={{ width: `${widthPct}%` }}>
                    {total > 0 && (
                      <>
                        <span
                          className="assignee-wl__seg assignee-wl__seg--open"
                          style={{ flex: r.open }}
                        />
                        <span
                          className="assignee-wl__seg assignee-wl__seg--ip"
                          style={{ flex: r.inProgress }}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="assignee-wl__nums" title={`Inbox: ${r.open} · In progress: ${r.inProgress}`}>
                <span className="assignee-wl__n assignee-wl__n--open">{r.open}</span>
                <span className="assignee-wl__sep" aria-hidden>
                  ·
                </span>
                <span className="assignee-wl__n assignee-wl__n--ip">{r.inProgress}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="assignee-wl__footer">
        <Link to="/developers" className="link-out">
          Roster &amp; skills
        </Link>
        <span className="assignee-wl__footer-sep" aria-hidden>
          ·
        </span>
        <Link to="/triage/new" className="link-out">
          New triage item
        </Link>
      </p>
    </div>
  );
}
