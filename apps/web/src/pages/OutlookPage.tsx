import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { InteractionRequiredAuthError, type AccountInfo } from "@azure/msal-browser";
import { MsalProvider, useMsal } from "@azure/msal-react";
import { useApi } from "../useApi";
import { useM365AppRegistration } from "../hooks/useM365AppRegistration";
import { m365GraphScopes, isM365Configured } from "../integrations/msalM365Config";
import { getM365Pca } from "../integrations/m365PublicClient";
import { PageHeader } from "../components/PageHeader";
import { CardPlaceholderSkeleton, OutlookFormSkeleton } from "../components/skeletons/AppSkeletons";

type Folder = { id: string; displayName: string };

function OutlookContent() {
  const { instance, accounts } = useMsal();
  const { requestWithGraph } = useApi();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [connectErr, setConnectErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        await instance.initialize();
        await instance.handleRedirectPromise();
        setReady(true);
      } catch (e) {
        console.error(e);
        setReady(true);
      }
    })();
  }, [instance]);

  const account: AccountInfo | null =
    instance.getActiveAccount() ?? accounts[0] ?? null;
  const getGraphToken = useCallback(async () => {
    if (!account) {
      throw new Error("msal_not_connected");
    }
    try {
      const r = await instance.acquireTokenSilent({
        scopes: [...m365GraphScopes],
        account,
      });
      return r.accessToken;
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        const r = await instance.acquireTokenPopup({
          scopes: [...m365GraphScopes],
          account,
        });
        return r.accessToken;
      }
      throw e;
    }
  }, [instance, account]);

  const connectMs = useCallback(async () => {
    setConnectErr(null);
    try {
      await instance.loginPopup({
        scopes: [...m365GraphScopes],
        prompt: "select_account",
      });
    } catch (e) {
      setConnectErr(e instanceof Error ? e.message : "Microsoft sign-in failed");
    }
  }, [instance]);

  const [folderId, setFolderId] = useState("");
  const [maxItems, setMaxItems] = useState(25);

  const foldersQuery = useQuery({
    queryKey: ["outlook-folders", account?.localAccountId, ready],
    enabled: ready && Boolean(account),
    queryFn: async () => {
      const gt = await getGraphToken();
      const res = await requestWithGraph("/api/outlook/folders", gt);
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "folders_failed");
      }
      return (await res.json()) as { folders: Folder[] };
    },
  });

  const importMut = useMutation({
    mutationFn: async () => {
      const gt = await getGraphToken();
      const res = await requestWithGraph("/api/outlook/import", gt, {
        method: "POST",
        body: JSON.stringify({ folderId, maxItems }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || "import_failed");
      }
      return (await res.json()) as { processed: number; message: string };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["triage-items"] });
      await qc.invalidateQueries({ queryKey: ["triage-summary"] });
    },
  });

  const folders = foldersQuery.data?.folders ?? [];

  if (!ready) {
    return (
      <div className="app-page">
        <PageHeader
          eyebrow="Apps"
          title="Outlook"
          lead="Initializing the Microsoft 365 connection."
        />
        <CardPlaceholderSkeleton />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="app-page">
        <PageHeader
          eyebrow="Apps"
          title="Outlook"
          lead="Import mail from Microsoft 365 into triage. Your normal app sign-in is separate and does not require this."
        />
        <div className="card">
          {connectErr && <p role="alert">{connectErr}</p>}
          <button type="button" className="primary" onClick={() => void connectMs()}>
            Connect Microsoft 365
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Apps"
        title="Import from Outlook"
        lead={
          <>
            Connected as <strong>{account.username}</strong>. Choose a folder; messages are upserted
            by message ID.
          </>
        }
      />
      <div className="card">
        {foldersQuery.isLoading && <OutlookFormSkeleton />}
        {!foldersQuery.isLoading && (
          <>
            {foldersQuery.isError && (
              <p role="alert">Could not load folders. Reconnect or check Mail.Read consent.</p>
            )}
            <div className="field">
              <label htmlFor="folder">Folder</label>
              <select id="folder" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                <option value="">Select…</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="max">Max messages (1–50)</label>
              <input
                id="max"
                type="number"
                min={1}
                max={50}
                value={maxItems}
                onChange={(e) => setMaxItems(Number(e.target.value))}
              />
            </div>
            {importMut.isError && <p role="alert">{(importMut.error as Error).message}</p>}
            {importMut.isSuccess && importMut.data && (
              <p>
                Processed <strong>{importMut.data.processed}</strong> messages.{" "}
                {importMut.data.message}
              </p>
            )}
            <div className="form-actions" style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className="primary"
                disabled={!folderId || importMut.isPending}
                onClick={() => importMut.mutate()}
              >
                {importMut.isPending ? "Importing…" : "Import"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void instance.logoutPopup({ postLogoutRedirectUri: window.location.origin });
                }}
              >
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function OutlookNotConfigured() {
  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Apps"
        title="Outlook"
        lead="This integration is not configured. The rest of the app works without it."
      />
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          A <strong>lead</strong> can set the Microsoft Entra <strong>tenant</strong> and{" "}
          <strong>client</strong> ID under <Link to="/apps/registration">App registration</Link>
          (or a server admin can set <code>M365_TENANT_ID</code> and <code>M365_CLIENT_ID</code> in
          the API environment). In Entra, use delegated <code>User.Read</code>, <code>Mail.Read</code>
          , and <code>Tasks.ReadWrite</code> for the same SPA.
        </p>
      </div>
    </div>
  );
}

export function OutlookPage() {
  const m365 = useM365AppRegistration();
  if (m365.isLoading) {
    return (
      <div className="app-page">
        <PageHeader
          eyebrow="Apps"
          title="Outlook"
          lead="Loading Microsoft 365 app registration from the server…"
        />
        <CardPlaceholderSkeleton />
      </div>
    );
  }
  if (m365.isError) {
    return (
      <div className="app-page">
        <PageHeader
          eyebrow="Apps"
          title="Outlook"
          lead="Could not load the Microsoft 365 app registration from the server."
        />
        <p role="alert">Request failed. Check your sign-in, then try again.</p>
      </div>
    );
  }
  if (!m365.data || !isM365Configured(m365.data.tenantId, m365.data.clientId)) {
    return <OutlookNotConfigured />;
  }
  return (
    <MsalProvider instance={getM365Pca(m365.data.tenantId, m365.data.clientId)}>
      <OutlookContent />
    </MsalProvider>
  );
}
