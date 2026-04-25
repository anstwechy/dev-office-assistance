import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { requireDbUser } from "../userService.js";

const LIMIT = 12;

export async function registerSearchRoutes(app: FastifyInstance) {
  app.get("/api/search", async (request, reply) => {
    const auth = request.authUser;
    const me = await requireDbUser(auth, reply);
    if (!me) return;

    const q = request.query as Record<string, string | undefined>;
    const raw = (q.q ?? "").trim();
    if (raw.length < 2) {
      return {
        q: raw,
        triage: [],
        planning: [],
        developers: [],
        decisions: [],
      };
    }
    const term = raw;

    const [triage, planning, developers, decisions] = await Promise.all([
      prisma.triageItem.findMany({
        where: {
          OR: [
            { title: { contains: term, mode: "insensitive" } },
            { description: { contains: term, mode: "insensitive" } },
            { program: { contains: term, mode: "insensitive" } },
          ],
        },
        take: LIMIT,
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, category: true, status: true },
      }),
      prisma.planningItem.findMany({
        where: {
          OR: [
            { title: { contains: term, mode: "insensitive" } },
            { description: { contains: term, mode: "insensitive" } },
            { department: { contains: term, mode: "insensitive" } },
            { program: { contains: term, mode: "insensitive" } },
          ],
        },
        take: LIMIT,
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, status: true },
      }),
      prisma.developer.findMany({
        where: {
          OR: [
            { displayName: { contains: term, mode: "insensitive" } },
            { skills: { contains: term, mode: "insensitive" } },
            { workEmail: { contains: term, mode: "insensitive" } },
            { jobTitle: { contains: term, mode: "insensitive" } },
          ],
        },
        take: LIMIT,
        orderBy: { displayName: "asc" },
        select: { id: true, displayName: true, skills: true },
      }),
      prisma.teamDecision.findMany({
        where: {
          OR: [
            { title: { contains: term, mode: "insensitive" } },
            { body: { contains: term, mode: "insensitive" } },
          ],
        },
        take: LIMIT,
        orderBy: { decidedOn: "desc" },
        select: { id: true, title: true, decidedOn: true },
      }),
    ]);

    return {
      q: term,
      triage,
      planning,
      developers,
      decisions: decisions.map((d) => ({
        id: d.id,
        title: d.title,
        decidedOn: d.decidedOn.toISOString().slice(0, 10),
      })),
    };
  });
}
