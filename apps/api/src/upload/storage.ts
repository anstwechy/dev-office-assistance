import { promises as fsp } from "node:fs";
import { join, extname, basename } from "node:path";
import { randomUUID } from "node:crypto";
import type { MultipartFile } from "@fastify/multipart";
import { isAllowedUploadMime } from "./mime.js";

function safeBasename(name: string): string {
  const b = basename(name).replace(/[^\w.\- ()[\]]/g, "_");
  return b.slice(0, 200) || "file";
}

function pickExtension(original: string, mime: string): string {
  const ext = extname(original).toLowerCase();
  if (ext && ext.length <= 8) return ext;
  if (mime === "application/pdf") return ".pdf";
  if (mime.startsWith("image/jpeg")) return ".jpg";
  if (mime.startsWith("image/png")) return ".png";
  if (mime.startsWith("image/webp")) return ".webp";
  if (mime.startsWith("audio/")) return ".m4a";
  return ".bin";
}

export type StoredFile = {
  storageKey: string;
  absolutePath: string;
  sizeBytes: number;
  originalName: string;
  mimeType: string;
};

export async function ensureUploadDir(uploadDir: string): Promise<void> {
  await fsp.mkdir(uploadDir, { recursive: true });
}

function writeToDisk(
  uploadDir: string,
  body: Buffer,
  storageKey: string,
  originalName: string,
  mimeType: string,
): StoredFile {
  const absolutePath = join(uploadDir, storageKey);
  return {
    storageKey,
    absolutePath,
    sizeBytes: body.length,
    originalName,
    mimeType,
  };
}

export async function storeMultipartFile(
  uploadDir: string,
  part: MultipartFile,
  maxBytes: number,
): Promise<StoredFile> {
  if (!isAllowedUploadMime(part.mimetype)) {
    throw new Error("unsupported_mime");
  }
  const originalName = safeBasename(part.filename);
  const ext = pickExtension(originalName, part.mimetype);
  const storageKey = `${randomUUID()}${ext}`;

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of part.file) {
    const b = chunk as Buffer;
    size += b.length;
    if (size > maxBytes) {
      throw new Error("file_too_large");
    }
    chunks.push(b);
  }
  const body = Buffer.concat(chunks);
  if (body.length > maxBytes) {
    throw new Error("file_too_large");
  }
  const meta = writeToDisk(uploadDir, body, storageKey, originalName, part.mimetype);
  await ensureUploadDir(uploadDir);
  await fsp.writeFile(meta.absolutePath, body);
  return meta;
}

export async function storeBufferFromBytes(
  uploadDir: string,
  body: Buffer,
  originalNameIn: string,
  mimeType: string,
  maxBytes: number,
): Promise<StoredFile> {
  if (body.length > maxBytes) {
    throw new Error("file_too_large");
  }
  if (!isAllowedUploadMime(mimeType)) {
    throw new Error("unsupported_mime");
  }
  const originalName = safeBasename(originalNameIn);
  const ext = pickExtension(originalName, mimeType);
  const storageKey = `${randomUUID()}${ext}`;
  const meta = writeToDisk(uploadDir, body, storageKey, originalName, mimeType);
  await ensureUploadDir(uploadDir);
  await fsp.writeFile(meta.absolutePath, body);
  return meta;
}

export function pathForKey(uploadDir: string, storageKey: string): string {
  if (storageKey.includes("..") || storageKey.includes("/") || storageKey.includes("\\")) {
    throw new Error("invalid_key");
  }
  return join(uploadDir, storageKey);
}

export async function deleteStoredFile(
  uploadDir: string,
  storageKey: string,
): Promise<void> {
  const p = pathForKey(uploadDir, storageKey);
  await fsp.unlink(p).catch(() => {});
}
