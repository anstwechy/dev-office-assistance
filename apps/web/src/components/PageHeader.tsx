import type { ReactNode } from "react";

export type PageHeaderProps = {
  /** Small caps label (section). */
  eyebrow: string;
  /** Page H1 — string or a short line (e.g. detail view title). */
  title: ReactNode;
  /** Supporting line or short orientation block under the title (omitted if empty). */
  lead?: ReactNode;
  /** e.g. primary action aligned with the title block. */
  actions?: ReactNode;
  className?: string;
};

/**
 * Shared page title block: matches `.page-hero` / `.page-eyebrow` / `.page-title` / `.page-lead` in index.css.
 * With `actions`, uses a two-column layout on wide viewports: title block left, primary actions right.
 */
export function PageHeader({ eyebrow, title, lead, actions, className }: PageHeaderProps) {
  return (
    <header
      className={["page-hero", actions ? "page-hero--with-actions" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="page-hero__row">
        <div className="page-hero__text">
          <span className="page-eyebrow">{eyebrow}</span>
          <h1 className="page-title">{title}</h1>
          {lead != null && lead !== "" ? (
            typeof lead === "string" ? (
              <p className="page-lead">{lead}</p>
            ) : (
              <div className="page-lead">{lead}</div>
            )
          ) : null}
        </div>
        {actions ? <div className="page-hero__actions">{actions}</div> : null}
      </div>
    </header>
  );
}
