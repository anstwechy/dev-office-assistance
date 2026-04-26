import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  Prisma,
  type TriageCategory,
  type TriageItem,
  type TriageStatus,
} from "@prisma/client";
import { createGraphClient } from "../graphClient.js";
import { graphStatusCode, readGraphToken } from "../graphHelpers.js";
import { prisma } from "../db.js";
import { requireDbUser } from "../userService.js";
import { getCurrentWeekRange } from "../weekRange.js";
import { patchGraphTodoToMatchTriage } from "../todoTriageService.js";

const categoryZ = z.enum([
  "blocker",
  "risk",
  "quality",
  "process",
  "other",
]);
const statusZ = z.enum([
  "inbox",
  "in_progress",
  "snoozed",
  "done",
  "dropped",
]);
const sourceZ = z.enum(["outlook", "manual", "microsoft_todo"]);

const createBody = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(8000).nullable().optional(),
  category: categoryZ,
  status: statusZ.optional(),
  nextAction: z.string().max(2000).nullable().optional(),
  dueAt: z.string().nullable().optional(),
  snoozedUntil: z.string().nullable().optional(),
  assigneeDeveloperId: z.string().min(1),
  program: z.string().max(200).nullable().optional(),
  escalated: z.boolean().optional(),
  sourceType: sourceZ.optional(),
  graphMessageId: z.string().nullable().optional(),
  graphWebLink: z.string().url().nullable().optional(),
  sourcePreview: z.string().max(500).nullable().optional(),
});

const patchBody = createBody
  .partial()
  .extend({
    title: z.string().min(1).max(500).optional(),
    graphWebLink: z.union([z.string().url(), z.null()]).optional(),
  });

type AttachmentListRow = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
};

type AssigneeForDto = { displayName: string };

function assigneeNameFromDeveloper(u: AssigneeForDto | null | undefined) {
  if (!u) return undefined;
  const n = u.displayName?.trim();
  if (n) return n;
  return "Unknown person";
}

function toDto(
  row: TriageItem & { assignee?: AssigneeForDto | null },
  extra?: { attachments?: AttachmentListRow[]; attachmentCount?: number; ageDays?: number },
) {
  const base = {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    nextAction: row.nextAction,
    dueAt: row.dueAt?.toISOString() ?? null,
    snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
    assigneeDeveloperId: row.assigneeDeveloperId,
    ...(row.assignee != null ? { assigneeName: assigneeNameFromDeveloper(row.assignee) } : {}),
    sourceType: row.sourceType,
    graphMessageId: row.graphMessageId,
    graphWebLink: row.graphWebLink,
    sourcePreview: row.sourcePreview,
    graphTodoListId: row.graphTodoListId,
    graphTodoTaskId: row.graphTodoTaskId,
    lastTodoSyncedAt: row.lastTodoSyncedAt?.toISOString() ?? null,
    program: row.program ?? null,
    escalated: row.escalated,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(extra?.ageDays !== undefined ? { ageDays: extra.ageDays } : {}),
  };
  if (extra?.attachments) {
    return {
      ...base,
      attachments: extra.attachments.map((a) => ({
        id: a.id,
        originalName: a.originalName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }
  if (extra?.attachmentCount !== undefined) {
    return { ...base, attachmentCount: extra.attachmentCount };
  }
  return base;
}

export async function registerTriageRoutes(app: FastifyInstance) {
  app.get("/api/triage-items/summary", async (request, reply) => {
    const auth = request.authUser;
    const me = await requireDbUser(auth, reply);
    if (!me) return;

    const now = new Date();
    const { start, end } = getCurrentWeekRange(now);

    const [byStatusRaw, byCategoryRaw, overdueCount, dueThisWeekCount] =
      await Promise.all([
        prisma.triageItem.groupBy({
          by: ["status"],
          _count: { _all: true },
        }),
        prisma.triageItem.groupBy({
          by: ["category"],
          _count: { _all: true },
        }),
        prisma.triageItem.count({
          where: {
            dueAt: { lt: now },
            status: { notIn: ["done", "dropped"] },
          },
        }),
        prisma.triageItem.count({
          where: {
            dueAt: { gte: start, lt: end },
            status: { notIn: ["done", "dropped"] },
          },
        }),
      ]);

    const byStatus = {
      inbox: 0,
      in_progress: 0,
      snoozed: 0,
      done: 0,
      dropped: 0,
    } as Record<TriageStatus, number>;
    for (const row of byStatusRaw) {
      byStatus[row.status] = row._count._all;
    }

    const byCategory = {
      blocker: 0,
      risk: 0,
      quality: 0,
      process: 0,
      other: 0,
    } as Record<TriageCategory, number>;
    for (const row of byCategoryRaw) {
      byCategory[row.category] = row._count._all;
    }

    return {
      byStatus,
      byCategory,
      overdueCount,
      dueThisWeekCount,
    };
  });

  app.get("/api/triage-items/priority-queue", async (request, reply) => {
    const auth = request.authUser;
    const me = await requireDbUser(auth, reply);
    if (!me) return;

    const now = new Date();
    const items = await prisma.triageItem.findMany({
      where: {
        status: { notIn: ["done", "dropped"] },
        OR: [
          { category: { in: ["blocker", "risk"] } },
          { escalated: true },
        ],
      },
      orderBy: [{ escalated: "desc" }, { createdAt: "asc" }],
      include: {
        assignee: { select: { displayName: true } },
        _count: { select: { attachments: true } },
      },
    });
    return {
      items: items.map((it) => {
        const ageMs = now.getTime() - it.createdAt.getTime();
        const ageDays = Math.max(0, Math.floor(ageMs / 86_400_000));
        return toDto(it, { attachmentCount: it._count.attachments, ageDays });
      }),
    };
  });

  app.get("/api/triage-items", async (request, reply) => {
    const auth = request.authUser;
    const me = await requireDbUser(auth, reply);
    if (!me) return;

    const q = request.query as Record<string, string | undefined>;
    const status = q.status ? statusZ.safeParse(q.status) : null;
    if (q.status && !status?.success) {
      return reply.status(400).send({ error: "invalid_status" });
    }
    const category = q.category ? categoryZ.safeParse(q.category) : null;
    if (q.category && !category?.success) {
      return reply.status(400).send({ error: "invalid_category" });
    }

    const where: Prisma.TriageItemWhereInput = {};
    if (status?.success) where.status = status.data;
    if (category?.success) where.category = category.data;
    if (q.assigneeDeveloperId) where.assigneeDeveloperId = q.assigneeDeveloperId;
    if (q.program && q.program.trim()) {
      where.program = q.program.trim();
    }

    const now = new Date();
    if (q.overdue === "true") {
      where.dueAt = { lt: now };
      where.status = { notIn: ["done", "dropped"] };
    }
    if (q.thisWeek === "true") {
      const { start, end } = getCurrentWeekRange(now);
      where.dueAt = { gte: start, lt: end };
      where.status = { notIn: ["done", "dropped"] };
    }
    if (q.dueBefore) {
      where.dueAt = {
        ...(where.dueAt as object),
        lt: new Date(q.dueBefore),
      };
    }
    if (q.dueAfter) {
      where.dueAt = {
        ...(where.dueAt as object),
        gt: new Date(q.dueAfter),
      };
    }

    const items = await prisma.triageItem.findMany({
      where,
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      include: {
        assignee: { select: { displayName: true } },
        _count: { select: { attachments: true } },
      },
    });
    return {
      items: items.map((it) =>
        toDto(it, { attachmentCount: it._count.attachments }),
      ),
    };
  });

  app.get("/api/triage-items/:id", async (request, reply) => {
    const auth = request.authUser;
    const me = await requireDbUser(auth, reply);
    if (!me) return;

    const { id } = request.params as { id: string };
    const item = await prisma.triageItem.findUnique({
      where: { id },
      include: {
        assignee: { select: { displayName: true } },
        attachments: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!item) return reply.status(404).send({ error: "not_found" });
    return toDto(item, { attachments: item.attachments });
  });

  app.post("/api/triage-items", async (request, reply) => {
    const auth = request.authUser;
    const me = await requireDbUser(auth, reply);
    if (!me) return;

    const parsed = createBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation", details: parsed.error.flatten() });
    }
    const b = parsed.data;

    const dueAt =
      b.dueAt === undefined ? undefined : b.dueAt === null ? null : new Date(b.dueAt);
    if (b.dueAt && dueAt && Number.isNaN(dueAt.getTime())) {
      return reply.status(400).send({ error: "invalid_dueAt" });
    }
    const snoozedUntil =
      b.snoozedUntil === undefined
        ? undefined
        : b.snoozedUntil === null
          ? null
          : new Date(b.snoozedUntil);
    if (b.snoozedUntil && snoozedUntil && Number.isNaN(snoozedUntil.getTime())) {
      return reply.status(400).send({ error: "invalid_snoozedUntil" });
    }

    const assignee = await prisma.developer.findUnique({
      where: { id: b.assigneeDeveloperId },
    });
    if (!assignee) {
      return reply.status(400).send({ error: "unknown_assignee" });
    }

    const program =
      b.program === undefined ? null : b.program === null ? null : b.program.trim() || null;

    const item = await prisma.triageItem.create({
      data: {
        title: b.title,
        description: b.description ?? null,
        category: b.category,
        status: b.status ?? "inbox",
        nextAction: b.nextAction ?? null,
        dueAt: dueAt ?? null,
        snoozedUntil: snoozedUntil ?? null,
        assigneeDeveloperId: b.assigneeDeveloperId,
        program,
        escalated: b.escalated ?? false,
        sourceType: b.sourceType ?? "manual",
        graphMessageId: b.graphMessageId ?? null,
        graphWebLink: b.graphWebLink ?? null,
        sourcePreview: b.sourcePreview ?? null,
        createdById: me.id,
      },
      include: { assignee: { select: { displayName: true } } },
    });
    return reply.status(201).send(toDto(item));
  });

  app.patch("/api/triage-items/:id", async (request, reply) => {
    const auth = request.authUser;
    const me = await requireDbUser(auth, reply);
    if (!me) return;

    const { id } = request.params as { id: string };
    const existing = await prisma.triageItem.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "not_found" });

    const parsed = patchBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation", details: parsed.error.flatten() });
    }
    const b = parsed.data;

    let dueAtPatch: Date | null | undefined;
    if (b.dueAt !== undefined) {
      if (b.dueAt === null) dueAtPatch = null;
      else {
        const d = new Date(b.dueAt);
        if (Number.isNaN(d.getTime())) {
          return reply.status(400).send({ error: "invalid_dueAt" });
        }
        dueAtPatch = d;
      }
    }
    let snoozedPatch: Date | null | undefined;
    if (b.snoozedUntil !== undefined) {
      if (b.snoozedUntil === null) snoozedPatch = null;
      else {
        const d = new Date(b.snoozedUntil);
        if (Number.isNaN(d.getTime())) {
          return reply.status(400).send({ error: "invalid_snoozedUntil" });
        }
        snoozedPatch = d;
      }
    }

    if (b.assigneeDeveloperId) {
      const assignee = await prisma.developer.findUnique({
        where: { id: b.assigneeDeveloperId },
      });
      if (!assignee) {
        return reply.status(400).send({ error: "unknown_assignee" });
      }
    }

    let pushedTodo = false;
    if (
      b.status !== undefined &&
      b.status !== existing.status &&
      existing.sourceType === "microsoft_todo" &&
      existing.graphTodoListId &&
      existing.graphTodoTaskId
    ) {
      const graphToken = readGraphToken(request);
      if (graphToken) {
        try {
          const g = createGraphClient(graphToken);
          await patchGraphTodoToMatchTriage(
            g,
            existing.graphTodoListId,
            existing.graphTodoTaskId,
            b.status,
          );
          pushedTodo = true;
        } catch (e) {
          const code = graphStatusCode(e);
          if (code === 401 || code === 403) {
            return reply.status(400).send({
              error: "todo_graph_write_denied",
              message:
                "Could not update Microsoft To Do. Connect Microsoft 365 (Tasks.ReadWrite) and retry, or change status again after signing in.",
            });
          }
          request.log.warn({ err: e }, "triage_todo_graph_patch_failed");
          return reply.status(502).send({ error: "todo_graph_unavailable" });
        }
      }
    }

    let programPatch: string | null | undefined;
    if (b.program !== undefined) {
      if (b.program === null) programPatch = null;
      else {
        const t = b.program.trim();
        programPatch = t === "" ? null : t;
      }
    }

    const item = await prisma.triageItem.update({
      where: { id },
      data: {
        ...(b.title !== undefined ? { title: b.title } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
        ...(b.category !== undefined ? { category: b.category } : {}),
        ...(b.status !== undefined ? { status: b.status } : {}),
        ...(b.nextAction !== undefined ? { nextAction: b.nextAction } : {}),
        ...(dueAtPatch !== undefined ? { dueAt: dueAtPatch } : {}),
        ...(snoozedPatch !== undefined ? { snoozedUntil: snoozedPatch } : {}),
        ...(b.assigneeDeveloperId !== undefined
          ? { assigneeDeveloperId: b.assigneeDeveloperId }
          : {}),
        ...(b.sourceType !== undefined ? { sourceType: b.sourceType } : {}),
        ...(b.graphMessageId !== undefined
          ? { graphMessageId: b.graphMessageId }
          : {}),
        ...(b.graphWebLink !== undefined ? { graphWebLink: b.graphWebLink } : {}),
        ...(b.sourcePreview !== undefined
          ? { sourcePreview: b.sourcePreview }
          : {}),
        ...(programPatch !== undefined ? { program: programPatch } : {}),
        ...(b.escalated !== undefined ? { escalated: b.escalated } : {}),
        ...(pushedTodo ? { lastTodoSyncedAt: new Date() } : {}),
      },
      include: { assignee: { select: { displayName: true } } },
    });

    return toDto(item);
  });
}
