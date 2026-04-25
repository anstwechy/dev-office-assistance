import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDisclosure } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import type { DeveloperDto, RosterPosition } from "@office/types";
import { useApi } from "../useApi";
import { PageHeader } from "../components/PageHeader";
import { DataTableSkeleton } from "../components/skeletons/AppSkeletons";
import { DeveloperModal } from "../components/developers/DeveloperModal";

function cellPreview(s: string | null, max = 64) {
  if (!s?.trim()) return "—";
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function rosterLabel(p: RosterPosition) {
  if (p === "department_head") return "Head";
  if (p === "department_assistant") return "Asst";
  return "—";
}

export function DevManagementPage() {
  const { request } = useApi();
  const [searchParams, setSearchParams] = useSearchParams();
  const devEdit = searchParams.get("edit");
  const [devModalMode, setDevModalMode] = useState<"create" | "edit">("create");
  const [devModalOpened, { open: openDevModal, close: closeDevModal }] = useDisclosure(false);

  const listQuery = useQuery({
    queryKey: ["developers"],
    queryFn: async () => {
      const res = await request("/api/developers");
      if (!res.ok) throw new Error("list_failed");
      return (await res.json()) as { developers: DeveloperDto[] };
    },
  });

  useEffect(() => {
    if (devEdit) {
      setDevModalMode("edit");
      openDevModal();
    }
  }, [devEdit, openDevModal]);

  const closeDeveloperModal = () => {
    closeDevModal();
    setSearchParams((p) => {
      p.delete("edit");
      return p;
    });
  };

  const openCreateDeveloper = () => {
    setDevModalMode("create");
    setSearchParams((p) => {
      p.delete("edit");
      return p;
    });
    openDevModal();
  };

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Directory"
        title="Dev management"
        lead="Roster for people you assign in triage and place on teams. Add or edit people in a dialog — not an app sign-in, only the lead and assistance accounts can log in."
      />

      <section className="card" aria-label="Roster list">
        <div className="card__head card__head--row">
          <div>
            <h2 className="card__title">Roster</h2>
            <p className="card__sub" style={{ marginBottom: 0 }}>
              Searchable from Team management. Use Add to open the form, or a name to edit.
            </p>
          </div>
          <div className="card__head__actions">
            <button type="button" className="primary" onClick={openCreateDeveloper}>
              Add person
            </button>
          </div>
        </div>
        {listQuery.isLoading && (
          <DataTableSkeleton
            columns={6}
            columnLabels={["Name", "Work email", "Job title", "Org", "Focus", ""]}
            tableLabel="Loading roster"
          />
        )}
        {listQuery.isError && <p role="alert">Could not load roster.</p>}
        {listQuery.data && (
          <div className="data-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Work email</th>
                  <th>Job title</th>
                  <th>Org</th>
                  <th>Focus / skills</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {listQuery.data.developers.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link
                        to={{ pathname: "/developers", search: new URLSearchParams({ edit: d.id }).toString() }}
                      >
                        {d.displayName}
                      </Link>
                    </td>
                    <td className="muted">{d.workEmail?.trim() || "—"}</td>
                    <td className="muted">{cellPreview(d.jobTitle, 80)}</td>
                    <td className="muted">{rosterLabel(d.rosterPosition)}</td>
                    <td className="muted">{cellPreview(d.skills)}</td>
                    <td>
                      <Link
                        to={{ pathname: "/developers", search: new URLSearchParams({ edit: d.id }).toString() }}
                        className="link-out"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {listQuery.data.developers.length === 0 && (
              <p className="muted" style={{ margin: "0.75rem" }}>
                No one on the roster yet. Add a person, then use Team management to place them in squads.
              </p>
            )}
          </div>
        )}
      </section>

      <DeveloperModal
        opened={devModalOpened}
        onClose={closeDeveloperModal}
        mode={devModalMode}
        developerId={devModalMode === "edit" && devEdit ? devEdit : null}
      />
    </div>
  );
}
