import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { prisma } from "../db.js";
import { requireDbUser } from "../userService.js";
import { getWeekStartDate } from "../weekRange.js";

const upsertBody = z.object({
  weekStart: z.string().optional(),
  priorWork: z.string().max(16000).optional(),
  nextWork: z.string().max(16000).optional(),
  blockers: z.string().max(16000).optional(),
});

function weekLabel(d: Date) {
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function registerStandupRoutes(app: FastifyInstance) {
  app.get("/api/standup", async (request, reply) => {
    const auth = request.authUser;
    const me = await requireDbUser(auth, reply);
    if (!me) return;

    const q = request.query as Record<string, string | undefined>;
    let weekStart = getWeekStartDate();
    if (q.weekStart) {
      const d = new Date(q.weekStart);
      if (!Number.isNaN(d.getTime())) {
        weekStart = getWeekStartDate(d);
      }
    }

    const users = await prisma.user.findMany({
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      select: { id: true, email: true, displayName: true },
    });

    const entries = await prisma.standupCheckIn.findMany({
      where: { weekStart },
      include: { user: { select: { email: true, displayName: true } } },
    });

    const byUser = new Map(entries.map((e) => [e.userId, e]));

    return {
      weekStart: weekStart.toISOString().slice(0, 10),
      weekLabel: `Week of ${weekLabel(weekStart)}`,
      entries: users.map((u) => {
        const row = byUser.get(u.id);
        if (row) {
          return {
            id: row.id,
            userId: row.userId,
            userDisplayName: row.user.displayName,
            userEmail: row.user.email,
            weekStart: row.weekStart.toISOString().slice(0, 10),
            priorWork: row.priorWork,
            nextWork: row.nextWork,
            blockers: row.blockers,
            updatedAt: row.updatedAt.toISOString(),
          };
        }
        return {
          id: `placeholder-${u.id}`,
          userId: u.id,
          userDisplayName: u.displayName,
          userEmail: u.email,
          weekStart: weekStart.toISOString().slice(0, 10),
          priorWork: "",
          nextWork: "",
          blockers: "",
          updatedAt: new Date(0).toISOString(),
        };
      }),
    };
  });

  app.put("/api/standup", async (request, reply) => {
    const auth = request.authUser;
    const me = await requireDbUser(auth, reply);
    if (!me) return;

    const parsed = upsertBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation", details: parsed.error.flatten() });
    }
    const b = parsed.data;
    let weekStart = getWeekStartDate();
    if (b.weekStart) {
      const d = new Date(b.weekStart);
      if (!Number.isNaN(d.getTime())) {
        weekStart = getWeekStartDate(d);
      }
    }

    const row = await prisma.standupCheckIn.upsert({
      where: {
        userId_weekStart: { userId: me.id, weekStart },
      },
      create: {
        id: randomUUID(),
        userId: me.id,
        weekStart,
        priorWork: b.priorWork ?? "",
        nextWork: b.nextWork ?? "",
        blockers: b.blockers ?? "",
      },
      update: {
        ...(b.priorWork !== undefined ? { priorWork: b.priorWork } : {}),
        ...(b.nextWork !== undefined ? { nextWork: b.nextWork } : {}),
        ...(b.blockers !== undefined ? { blockers: b.blockers } : {}),
      },
      include: { user: { select: { email: true, displayName: true } } },
    });

    return {
      id: row.id,
      userId: row.userId,
      userDisplayName: row.user.displayName,
      userEmail: row.user.email,
      weekStart: row.weekStart.toISOString().slice(0, 10),
      priorWork: row.priorWork,
      nextWork: row.nextWork,
      blockers: row.blockers,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}
