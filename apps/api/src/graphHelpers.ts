import type { FastifyRequest } from "fastify";

export function graphStatusCode(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null && "statusCode" in err) {
    const n = (err as { statusCode: unknown }).statusCode;
    return typeof n === "number" ? n : undefined;
  }
  return undefined;
}

/** Microsoft Graph access token from the web app (MSAL) — passed per request, not stored server-side. */
export function readGraphToken(request: FastifyRequest): string | null {
  const raw = request.headers["x-graph-access-token"];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || typeof v !== "string" || !v.trim()) return null;
  return v.trim();
}
