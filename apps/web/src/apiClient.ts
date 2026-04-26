import { getActiveAccessToken } from "./auth/authToken";

const apiBase =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = getActiveAccessToken();
  if (!token) {
    throw new Error("not_signed_in");
  }
  const url = `${apiBase}${path}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!isForm && !headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...init, headers });
}

/** Same as apiFetch but adds Microsoft Graph access token (optional email integration). */
export async function apiFetchWithGraph(
  path: string,
  graphAccessToken: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = getActiveAccessToken();
  if (!token) {
    throw new Error("not_signed_in");
  }
  const url = `${apiBase}${path}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("X-Graph-Access-Token", graphAccessToken);
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!isForm && !headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...init, headers });
}

/** Authed file download in the browser (GET attachment with Bearer token). */
export async function apiDownload(
  path: string,
  filename: string,
): Promise<void> {
  const res = await apiFetch(path);
  if (!res.ok) {
    throw new Error("download_failed");
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

/**
 * Fetches a file with auth and opens it in a new tab (PDF/images display inline when possible).
 */
export async function apiViewInNewTab(
  path: string,
  filenameHint: string,
): Promise<void> {
  const res = await apiFetch(path);
  if (!res.ok) {
    throw new Error("view_failed");
  }
  const blob = await res.blob();
  const ext = filenameHint.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const mime =
    ext === "pdf"
      ? "application/pdf"
      : ext && ["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(ext)
        ? `image/${ext === "jpg" ? "jpeg" : ext === "heic" ? "heic" : ext}`
        : blob.type;
  const displayBlob =
    mime && mime !== "application/octet-stream" ? new Blob([blob], { type: mime }) : blob;
  const objectUrl = URL.createObjectURL(displayBlob);
  const w = window.open(objectUrl, "_blank", "noopener,noreferrer");
  if (!w) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("popup_blocked");
  }
  // Give the new tab time to read the blob before revoking
  setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
}
