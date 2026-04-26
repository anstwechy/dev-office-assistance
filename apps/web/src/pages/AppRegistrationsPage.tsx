import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../apiClient";
import { useM365AppRegistration } from "../hooks/useM365AppRegistration";
import { clearM365PcaCache } from "../integrations/m365PublicClient";
import { PageHeader } from "../components/PageHeader";
import { CardPlaceholderSkeleton } from "../components/skeletons/AppSkeletons";

export function AppRegistrationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const m365Q = useM365AppRegistration();
  const isLead = user?.role === "lead";

  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    if (m365Q.data) {
      setTenantId(m365Q.data.tenantId);
      setClientId(m365Q.data.clientId);
    }
  }, [m365Q.data?.tenantId, m365Q.data?.clientId]);

  const saveMut = useMutation({
    mutationFn: async (body: { tenantId: string; clientId: string }) => {
      const res = await apiFetch("/api/integrations/m365", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        throw new Error(j.message || j.error || "save_failed");
      }
      return (await res.json()) as { tenantId: string; clientId: string; configured: boolean; fromDatabase: boolean };
    },
    onSuccess: () => {
      clearM365PcaCache();
      void qc.invalidateQueries({ queryKey: ["m365-app-registration"] });
    },
  });

  if (m365Q.isLoading) {
    return (
      <div className="app-page">
        <PageHeader
          eyebrow="Apps"
          title="App registrations"
          lead="Loading current Microsoft 365 (Entra) application settings from the server."
        />
        <CardPlaceholderSkeleton />
      </div>
    );
  }

  if (m365Q.isError) {
    return (
      <div className="app-page">
        <PageHeader
          eyebrow="Apps"
          title="App registrations"
          lead="Optional Microsoft 365 app registration (tenant and client) used by Outook and To Do in this app."
        />
        <p role="alert">Could not load app registration. Try again in a moment.</p>
      </div>
    );
  }

  const d = m365Q.data!;

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Apps"
        title="App registrations"
        lead={
          <>
            This does not create an app in Microsoft Entra — you still create the SPA in the Azure
            portal.             Here you only store the <strong>Directory (tenant) ID</strong> and{" "}
            <strong>Application (client) ID</strong> so the web app can run MSAL without redeploying
            the static bundle. Values from the API server environment (see <code>M365_TENANT_ID</code>{" "}
            / <code>M365_CLIENT_ID</code>) are used if the database is empty; saving here stores IDs
            in the database for everyone.
          </>
        }
      />

      <div className="card" style={{ marginTop: 0 }}>
        <h2 className="page-title" style={{ fontSize: "1.15rem", marginTop: 0, marginBottom: "0.35rem" }}>
          Microsoft 365
        </h2>
        <p className="muted" style={{ marginTop: 0, fontSize: "0.95rem" }}>
          In Entra, register a single-page app with redirect URI <code>{window.location.origin}</code> and
          delegated permissions: <code>User.Read</code>, <code>Mail.Read</code>, <code>Tasks.ReadWrite</code>.
        </p>

        <p className="muted" style={{ fontSize: "0.9rem" }}>
          Status: {d.configured ? "ready for Outlook / To Do" : "not configured yet"}
          {d.configured && d.fromDatabase ? " (from database)" : d.configured ? " (from server environment)" : null}
        </p>

        {!isLead && (
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            Only a user with the <strong>lead</strong> role can change these values. You can read the
            current IDs below; ask a lead to open this page to edit.
          </p>
        )}

        <div className="field" style={{ marginTop: "1rem" }}>
          <label htmlFor="m365-tenant">Directory (tenant) ID</label>
          <input
            id="m365-tenant"
            type="text"
            name="m365-tenant"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            readOnly={!isLead}
            autoComplete="off"
            spellCheck={false}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            style={!isLead ? { cursor: "not-allowed" } : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="m365-client">Application (client) ID</label>
          <input
            id="m365-client"
            type="text"
            name="m365-client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            readOnly={!isLead}
            autoComplete="off"
            spellCheck={false}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            style={!isLead ? { cursor: "not-allowed" } : undefined}
          />
        </div>

        {isLead && (
          <div className="form-actions" style={{ marginTop: "1rem" }}>
            {saveMut.isError && <p role="alert">{(saveMut.error as Error).message}</p>}
            {saveMut.isSuccess && <p>Saved. Users may need to reconnect Microsoft 365 in Outlook or To Do.</p>}
            <button
              type="button"
              className="primary"
              disabled={saveMut.isPending}
              onClick={() => {
                const t = tenantId.trim();
                const c = clientId.trim();
                if (!t && !c) {
                  if (!window.confirm("Clear saved tenant and client IDs? Outlook and To Do will stop working until reconfigured.")) {
                    return;
                  }
                }
                saveMut.mutate({ tenantId: t, clientId: c });
              }}
            >
              {saveMut.isPending ? "Saving…" : "Save Microsoft 365 registration"}
            </button>
          </div>
        )}
      </div>

      <p className="muted" style={{ fontSize: "0.9rem", marginTop: "1.5rem" }}>
        More providers (Slack, etc.) can be added in this area later; only Microsoft 365 is wired
        today.
      </p>
    </div>
  );
}
