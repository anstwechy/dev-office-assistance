import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createGraphClient } from "../graphClient.js";
import { graphStatusCode, readGraphToken } from "../graphHelpers.js";
import { prisma } from "../db.js";
import { requireDbUser } from "../userService.js";

const importBody = z.object({
  folderId: z.string().min(1),
  maxItems: z.coerce.number().int().min(1).max(50).default(25),
  /** Roster id (Developer). If omitted, uses the first developer by name. */
  assigneeDeveloperId: z.string().min(1).optional(),
});

type GraphMessageList = {
  value?: Array<{
    id?: string;
    subject?: string | null;
    webLink?: string | null;
    receivedDateTime?: string | null;
    from?: { emailAddress?: { name?: string | null; address?: string | null } };
  }>;
};

export async function registerOutlookRoutes(app: FastifyInstance) {
  app.get("/api/outlook/folders", async (request, reply) => {
    const auth = request.authUser;
    const me = await requireDbUser(auth, reply);
    if (!me) return;

    const graphToken = readGraphToken(request);
    if (!graphToken) {
      return reply.status(400).send({
        error: "graph_token_required",
        message:
          "Email integration: sign in with Microsoft in the app (Email page) to obtain a token for this request.",
      });
    }

    const client = createGraphClient(graphToken);
    try {
      const res = await client.api("/me/mailFolders").top(50).get();
      const folders = (res.value as Array<{ id: string; displayName: string }>) ?? [];
      return {
        folders: folders.map((f) => ({
          id: f.id,
          displayName: f.displayName,
        })),
      };
    } catch (e) {
      const code = graphStatusCode(e);
      if (code === 401 || code === 403) {
        return reply.status(403).send({
          error: "mail_read_required",
          message:
            "Microsoft Graph denied mailbox access. On the Outlook page, sign in and accept Mail.Read.",
        });
      }
      request.log.error({ err: e }, "outlook_folders_graph_error");
      return reply.status(502).send({ error: "graph_unavailable" });
    }
  });

  app.post("/api/outlook/import", async (request, reply) => {
    const auth = request.authUser;
    const me = await requireDbUser(auth, reply);
    if (!me) return;

    const graphToken = readGraphToken(request);
    if (!graphToken) {
      return reply.status(400).send({
        error: "graph_token_required",
        message:
          "Microsoft 365: sign in on the Outlook app page first.",
      });
    }

    const parsed = importBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "validation", details: parsed.error.flatten() });
    }
    const { folderId, maxItems, assigneeDeveloperId: assigneeFromBody } = parsed.data;

    const client = createGraphClient(graphToken);
    let messages: NonNullable<GraphMessageList["value"]> = [];
    try {
      const res = (await client
        .api(`/me/mailFolders/${folderId}/messages`)
        .top(maxItems)
        .orderby("receivedDateTime desc")
        .select("id,subject,webLink,receivedDateTime,from")
        .get()) as GraphMessageList;
      messages = res.value ?? [];
    } catch (e) {
      const code = graphStatusCode(e);
      if (code === 401 || code === 403) {
        return reply.status(403).send({
          error: "mail_read_required",
          message:
            "Microsoft Graph denied mailbox access. Reconnect on the Outlook page and accept Mail.Read.",
        });
      }
      request.log.error({ err: e }, "outlook_import_graph_error");
      return reply.status(502).send({ error: "graph_unavailable" });
    }

    let processed = 0;

    const uid = me.id;

    let assigneeDeveloperId: string;
    if (assigneeFromBody) {
      const d = await prisma.developer.findUnique({ where: { id: assigneeFromBody } });
      if (!d) {
        return reply.status(400).send({ error: "unknown_assignee" });
      }
      assigneeDeveloperId = d.id;
    } else {
      const fallback = await prisma.developer.findFirst({
        orderBy: { displayName: "asc" },
      });
      if (!fallback) {
        return reply.status(400).send({
          error: "no_developers",
          message: "Add at least one person in Dev management (roster) before importing mail.",
        });
      }
      assigneeDeveloperId = fallback.id;
    }

    for (const m of messages) {
      if (!m.id) continue;
      const title = (m.subject && m.subject.trim()) || "(no subject)";
      const fromLine = m.from?.emailAddress?.address
        ? `${m.from.emailAddress.name ?? ""} <${m.from.emailAddress.address}>`.trim()
        : null;
      const preview = fromLine ? `${title} — ${fromLine}` : title;

      await prisma.triageItem.upsert({
        where: { graphMessageId: m.id },
        create: {
          title,
          description: null,
          category: "other",
          status: "inbox",
          nextAction: null,
          dueAt: null,
          snoozedUntil: null,
          assigneeDeveloperId,
          sourceType: "outlook",
          graphMessageId: m.id,
          graphWebLink: m.webLink ?? null,
          sourcePreview: preview.slice(0, 500),
          createdById: uid,
        },
        update: {
          title,
          graphWebLink: m.webLink ?? null,
          sourcePreview: preview.slice(0, 500),
        },
      });
      processed += 1;
    }

    return {
      processed,
      message: "Items upserted by graphMessageId (no duplicates).",
    };
  });
}
