import { useEffect, useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeveloperDto, RosterPosition } from "@office/types";
import { ROSTER_POSITIONS } from "@office/types";
import { useApi } from "../../useApi";
import { FormModal } from "../modals/FormModal";

export type DeveloperModalProps = {
  opened: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  developerId: string | null;
};

export function DeveloperModal({ opened, onClose, mode, developerId }: DeveloperModalProps) {
  const uid = useId();
  const f = `dev-mod-${uid}`;
  const { request } = useApi();
  const qc = useQueryClient();

  const [displayName, setDisplayName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState("");
  const [skillDetails, setSkillDetails] = useState("");
  const [achievements, setAchievements] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [tenureLabel, setTenureLabel] = useState("");
  const [rosterPosition, setRosterPosition] = useState<RosterPosition>("member");

  const itemQuery = useQuery({
    queryKey: ["developer", developerId],
    enabled: opened && mode === "edit" && Boolean(developerId),
    queryFn: async () => {
      const res = await request(`/api/developers/${developerId}`);
      if (!res.ok) throw new Error("load_failed");
      return (await res.json()) as DeveloperDto;
    },
  });

  const d = itemQuery.data;

  useEffect(() => {
    if (!opened) return;
    if (mode === "create") {
      setDisplayName("");
      setWorkEmail("");
      setPhone("");
      setLocation("");
      setBio("");
      setSkills("");
      setSkillDetails("");
      setAchievements("");
      setJobTitle("");
      setHireDate("");
      setTenureLabel("");
      setRosterPosition("member");
      return;
    }
    if (mode === "edit" && d) {
      setDisplayName(d.displayName);
      setWorkEmail(d.workEmail ?? "");
      setPhone(d.phone ?? "");
      setLocation(d.location ?? "");
      setBio(d.bio ?? "");
      setSkills(d.skills ?? "");
      setSkillDetails(d.skillDetails ?? "");
      setAchievements(d.achievements ?? "");
      setJobTitle(d.jobTitle ?? "");
      setHireDate(d.hireDate ?? "");
      setTenureLabel(d.tenureLabel ?? "");
      setRosterPosition(d.rosterPosition);
    }
  }, [opened, mode, d, developerId]);

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await request("/api/developers", {
        method: "POST",
        body: JSON.stringify({
          displayName: displayName.trim(),
          workEmail: workEmail.trim() || undefined,
          phone: phone.trim() || undefined,
          location: location.trim() || undefined,
          bio: bio.trim() || undefined,
          skills: skills.trim() || undefined,
          skillDetails: skillDetails.trim() || undefined,
          achievements: achievements.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          hireDate: hireDate.trim() || null,
          tenureLabel: tenureLabel.trim() || undefined,
          rosterPosition: rosterPosition !== "member" ? rosterPosition : undefined,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "create_failed");
      }
      return (await res.json()) as DeveloperDto;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["developers"] });
      await qc.invalidateQueries({ queryKey: ["team-memberships"] });
      await qc.invalidateQueries({ queryKey: ["users"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
      onClose();
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await request(`/api/developers/${developerId}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: displayName.trim(),
          workEmail: workEmail.trim() || null,
          phone: phone.trim() || null,
          location: location.trim() || null,
          bio: bio.trim() || null,
          skills: skills.trim() || null,
          skillDetails: skillDetails.trim() || null,
          achievements: achievements.trim() || null,
          jobTitle: jobTitle.trim() || null,
          hireDate: hireDate.trim() || null,
          tenureLabel: tenureLabel.trim() || null,
          rosterPosition,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "save_failed");
      }
      return (await res.json()) as DeveloperDto;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["developer", developerId] });
      await qc.invalidateQueries({ queryKey: ["developers"] });
      await qc.invalidateQueries({ queryKey: ["team-memberships"] });
      await qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const res = await request(`/api/developers/${developerId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const t = await res.text();
        let msg = t;
        try {
          const j = JSON.parse(t) as { error?: string };
          if (j.error === "has_related_data") {
            msg =
              "Cannot delete: this person is still the assignee on at least one triage item. Reassign those items first.";
          } else {
            msg = j.error ?? t;
          }
        } catch {
          /* text */
        }
        throw new Error(msg);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["developers"] });
      await qc.invalidateQueries({ queryKey: ["team-memberships"] });
      await qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
  });

  const busy = createMut.isPending || saveMut.isPending || deleteMut.isPending;
  const ready = mode === "create" || (mode === "edit" && d && !itemQuery.isLoading);

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={mode === "create" ? "Add to roster" : "Edit person"}
      size="lg"
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
    >
      {mode === "edit" && itemQuery.isLoading && <p className="muted">Loading…</p>}
      {mode === "edit" && itemQuery.isError && <p role="alert">Could not load this person.</p>}
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
          <p className="card__sub" style={{ marginTop: 0, marginBottom: "0.85rem" }}>
            {mode === "create"
              ? "Name is required. Other fields help triage and team search. Internal only — not a login account."
              : "Update roster details. This does not create app sign-in access."}
          </p>
          <div className="field">
            <label htmlFor={`${f}-dn`}>Name</label>
            <input
              id={`${f}-dn`}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={200}
              disabled={busy}
            />
          </div>
          <h3 className="dev-form-section">Role &amp; HR (from org sheet)</h3>
          <div className="field">
            <label htmlFor={`${f}-jt`}>Job title</label>
            <input
              id={`${f}-jt`}
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              maxLength={200}
              disabled={busy}
              placeholder="e.g. Back-End, QA"
            />
          </div>
          <div className="toolbar" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <label htmlFor={`${f}-hd`}>Hire date</label>
              <input
                id={`${f}-hd`}
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <label htmlFor={`${f}-ten`}>Tenure (as on sheet)</label>
              <input
                id={`${f}-ten`}
                value={tenureLabel}
                onChange={(e) => setTenureLabel(e.target.value)}
                maxLength={120}
                disabled={busy}
                placeholder="e.g. 3 years, 2 months"
              />
            </div>
            <div>
              <label htmlFor={`${f}-rp`}>Roster position</label>
              <select
                id={`${f}-rp`}
                value={rosterPosition}
                onChange={(e) => setRosterPosition(e.target.value as RosterPosition)}
                disabled={busy}
              >
                {ROSTER_POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p === "department_head" ? "Department head" : p === "department_assistant" ? "Department assistant" : "Member"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <h3 className="dev-form-section">Contact &amp; location</h3>
          <div className="toolbar" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <label htmlFor={`${f}-em`}>Work email (optional)</label>
              <input
                id={`${f}-em`}
                type="email"
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                maxLength={320}
                autoComplete="off"
                disabled={busy}
              />
            </div>
            <div>
              <label htmlFor={`${f}-ph`}>Phone (optional)</label>
              <input
                id={`${f}-ph`}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={64}
                autoComplete="off"
                disabled={busy}
              />
            </div>
            <div>
              <label htmlFor={`${f}-loc`}>Location (optional)</label>
              <input
                id={`${f}-loc`}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
                disabled={busy}
                placeholder="e.g. Berlin · CET"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor={`${f}-bio`}>About / personal note (optional)</label>
            <textarea
              id={`${f}-bio`}
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={16000}
              disabled={busy}
            />
          </div>
          <h3 className="dev-form-section">Skills &amp; experience</h3>
          <div className="field">
            <label htmlFor={`${f}-sk`}>Skills &amp; focus — short (optional)</label>
            <textarea
              id={`${f}-sk`}
              rows={2}
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              maxLength={16000}
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor={`${f}-sd`}>Skill details (optional)</label>
            <textarea
              id={`${f}-sd`}
              rows={2}
              value={skillDetails}
              onChange={(e) => setSkillDetails(e.target.value)}
              maxLength={16000}
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor={`${f}-ac`}>Achievements &amp; highlights (optional)</label>
            <textarea
              id={`${f}-ac`}
              rows={2}
              value={achievements}
              onChange={(e) => setAchievements(e.target.value)}
              maxLength={16000}
              disabled={busy}
            />
          </div>
          {(mode === "create" ? createMut.isError : saveMut.isError) && (
            <p role="alert">{((mode === "create" ? createMut.error : saveMut.error) as Error).message}</p>
          )}
          {deleteMut.isError && <p role="alert">{(deleteMut.error as Error).message}</p>}
          <div className="form-actions">
            <button type="submit" className="primary" disabled={busy}>
              {mode === "create" ? (createMut.isPending ? "Adding…" : "Add person") : saveMut.isPending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            {mode === "edit" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Remove this person from the roster? They must not be the assignee on any triage item.",
                    )
                  ) {
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
