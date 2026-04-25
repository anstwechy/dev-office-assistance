/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Legacy; Microsoft 365 IDs now come from the API (`/api/integrations/m365` or `M365_*` server env). */
  readonly VITE_AZURE_TENANT_ID?: string;
  readonly VITE_AZURE_CLIENT_ID?: string;
  readonly VITE_API_BASE_URL?: string;
  /** Set at build for GitHub Pages or subpath hosting (must end with `/`, e.g. `/repo-name/`). */
  readonly VITE_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
