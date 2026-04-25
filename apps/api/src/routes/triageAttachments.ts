import type { FastifyInstance } from "fastify";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import type { Env } from "../env.js";
import { prisma } from "../db.js";
import { requireDbUser } from "../userService.js";
import { deleteStoredFile, pathForKey, storeMultipartFile } from "../upload/storage.js";

function uploadRoot(env: Env): string {
  return resolve(process.cwd(), env.UPLOAD_DIR);
}

export async function registerTriageAttachmentRoutes(app: FastifyInstance, env: Env) {
  const root = uploadRoot(env);

  app.post("/api/triage-items/:triageId/attachments", async (request, reply) => {
    const auth = request.authUser;
    const me = await requireDbUser(auth, reply);
    if (!me) return;

    const { triageId } = request.params as { triageId: string };
    const item = await prisma.triageItem.findUnique({ where: { id: triageId } });
    if (!item) {
      return reply.status(404).send({ error: "not_found" });
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: "missing_file" });
    }

    let stored;
    try {
      stored = await storeMultipartFile(root, data, env.MAX_UPLOAD_BYTES);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "file_too_large") {
        return reply.status(413).send({ error: "file_too_large" });
      }
      if (msg === "unsupported_mime") {
        return reply.status(400).send({ error: "unsupported_mime" });
      }
      throw e;
    }

    const row = await prisma.triageAttachment.create({
      data: {
        triageItemId: triageId,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        storageKey: stored.storageKey,
        createdById: me.id,
      },
    });

    return reply.status(201).send({
      id: row.id,
      triageItemId: row.triageItemId,
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt.toISOString(),
    });
  });

  app.get("/api/triage-attachments/:id/file", async (request, reply) => {
    const auth = request.authUser;
    const me = await requireDbUser(auth, reply);
    if (!me) return;

    const { id } = request.params as { id: string };
    const row = await prisma.triageAttachment.findUnique({ where: { id } });
    if (!row) {
      return reply.status(404).send({ error: "not_found" });
    }

    const abs = pathForKey(root, row.storageKey);
    reply
      .header(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(row.originalName)}`,
      )
      .type(row.mimeType);
    return reply.send(createReadStream(abs));
  });

  app.delete("/api/triage-attachments/:id", async (request, reply) => {
    const auth = request.authUser;
    const me = await requireDbUser(auth, reply);
    if (!me) return;

    const { id } = request.params as { id: string };
    const row = await prisma.triageAttachment.findUnique({ where: { id } });
    if (!row) {
      return reply.status(404).send({ error: "not_found" });
    }

    await prisma.triageAttachment.delete({ where: { id } });
    await deleteStoredFile(root, row.storageKey);
    return reply.status(204).send();
  });
}
