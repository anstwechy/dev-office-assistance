/** Voice, PDF, images, docs, zips for internal triage & expense receipts */
export function isAllowedUploadMime(mime: string): boolean {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return true;
  if (m.startsWith("audio/")) return true;
  if (m.startsWith("video/")) return true;
  if (m === "application/pdf") return true;
  if (m === "text/plain" || m === "text/csv") return true;
  if (m === "application/zip" || m === "application/x-zip-compressed") return true;
  if (m.startsWith("application/vnd.openxmlformats")) return true;
  if (m === "application/msword") return true;
  return false;
}
