import { PublicClientApplication } from "@azure/msal-browser";
import { buildM365MsalConfig } from "./msalM365Config";

let cache: { key: string; pca: PublicClientApplication } | null = null;

/**
 * Reuses one MSAL instance per (tenant, client) pair. Call {@link clearM365PcaCache} after
 * app registration values change in the API.
 */
export function getM365Pca(tenantId: string, clientId: string): PublicClientApplication {
  const key = `${tenantId}\n${clientId}`;
  if (!cache || cache.key !== key) {
    const pca = new PublicClientApplication(buildM365MsalConfig(tenantId, clientId));
    const acc = pca.getAllAccounts();
    if (acc[0]) pca.setActiveAccount(acc[0]);
    cache = { key, pca };
  }
  return cache.pca;
}

export function clearM365PcaCache(): void {
  cache = null;
}
