import type { Configuration } from "@azure/msal-browser";

/**
 * Delegated Microsoft Graph scopes for the Apps integration (SPA).
 * Add matching **Microsoft Graph** delegated permissions in Entra: User.Read, Mail.Read, Tasks.ReadWrite.
 */
export const m365GraphScopes = [
  "User.Read",
  "Mail.Read",
  "Tasks.ReadWrite",
] as const;

/** @deprecated use `m365GraphScopes` */
export const emailGraphScopes = m365GraphScopes;

export function buildM365MsalConfig(tenantId: string, clientId: string): Configuration {
  return {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri: window.location.origin,
    },
    cache: {
      cacheLocation: "sessionStorage",
      storeAuthStateInCookie: false,
    },
  };
}

export function isM365Configured(tenantId: string | null | undefined, clientId: string | null | undefined): boolean {
  return Boolean(
    (tenantId && String(tenantId).trim()) && (clientId && String(clientId).trim()),
  );
}
