import type { FastifyInstance } from "fastify";
import type { DevTeam, PlanningStatus, TriageStatus } from "@prisma/client";
import { prisma } from "../db.js";
import { requireDbUser } from "../userService.js";

const ALL_PLANNING: PlanningStatus[] = ["draft", "active", "done", "cancelled"];

/** Prisma's `notIn` expects a mutable `TriageStatus[]`, not a readonly tuple from `as const`. */
const CLOSED_TRIAGE: TriageStatus[] = ["done", "dropped"];

function prismaGroupCountAll(row: { _count?: true | { _all?: number } }): number {
  const c = row._count;
  if (c && typeof c === "object" && "_all" in c) {
    return Number((c as { _all: number })._all) || 0;
  }
  return 0;
}

function startEndOfCurrentMonth() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to, monthIndex: now.getMonth(), year: now.getFullYear() };
}

function monthLabel(y: number, m: number) {
  return new Date(y, m, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export async function registerDashboardOverviewRoutes(app: FastifyInstance) {
  app.get("/api/dashboard-overview", async (request, reply) => {
    const auth = request.authUser;
    const me = await requireDbUser(auth, reply);
    if (!me) return;

    const { from, to, monthIndex, year } = startEndOfCurrentMonth();
    const periodLabel = monthLabel(year, monthIndex);

    const expenseWhere = { expenseDate: { gte: from, lte: to } } as const;

    const openWhere = { status: { notIn: CLOSED_TRIAGE } };

    const [
      byCurrencyRows,
      monthEntryCount,
      receiptCount,
      planGroups,
      teamGroups,
      teamUserRows,
      openBlockerRisk,
      escalatedOpen,
      workloadGroups,
    ] =
      await Promise.all([
        prisma.expense.groupBy({
          by: ["currency"],
          where: expenseWhere,
          _sum: { amount: true },
        }),
        prisma.expense.count({ where: expenseWhere }),
        prisma.expense.count({
          where: {
            ...expenseWhere,
            receiptKey: { not: null },
          },
        }),
        prisma.planningItem.groupBy({
          by: ["status"],
          _count: { _all: true },
        }),
        prisma.teamMembership.groupBy({
          by: ["team"],
          _count: { _all: true },
        }),
        prisma.teamMembership.findMany({ select: { developerId: true } }),
        prisma.triageItem.count({
          where: {
            ...openWhere,
            category: { in: ["blocker", "risk"] },
          },
        }),
        prisma.triageItem.count({
          where: { ...openWhere, escalated: true },
        }),
        prisma.triageItem.groupBy({
          by: ["assigneeDeveloperId", "status"],
          where: { status: { in: ["inbox", "in_progress"] } },
          _count: { _all: true },
        }),
      ]);

    const byCurrency = byCurrencyRows
      .map((r) => ({
        currency: r.currency || "USD",
        total: r._sum.amount?.toString() ?? "0",
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency));

    const byStatus: Record<PlanningStatus, number> = {
      draft: 0,
      active: 0,
      done: 0,
      cancelled: 0,
    };
    for (const g of planGroups) {
      byStatus[g.status] = prismaGroupCountAll(g);
    }
    const planningTotal = ALL_PLANNING.reduce((acc, s) => acc + byStatus[s], 0);

    const byTeam: Record<DevTeam, number> = {
      backend: 0,
      qa: 0,
      frontend_web: 0,
      frontend_mobile: 0,
    };
    for (const g of teamGroups) {
      byTeam[g.team] = prismaGroupCountAll(g);
    }
    const totalMemberships = teamGroups.reduce((acc, g) => acc + prismaGroupCountAll(g), 0);
    const uniqueDevelopers = new Set(teamUserRows.map((r) => r.developerId)).size;

    const developerIds = Array.from(new Set(workloadGroups.map((g) => g.assigneeDeveloperId)));
    const workloadDevelopers = developerIds.length
      ? await prisma.developer.findMany({
          where: { id: { in: developerIds } },
          select: { id: true, displayName: true },
        })
      : [];
    const developerNames = new Map(workloadDevelopers.map((d) => [d.id, d.displayName]));
    const workloadByDeveloper = new Map<string, { developerId: string; displayName: string; open: number; inProgress: number }>();
    for (const g of workloadGroups) {
      const row = workloadByDeveloper.get(g.assigneeDeveloperId) ?? {
        developerId: g.assigneeDeveloperId,
        displayName: developerNames.get(g.assigneeDeveloperId) ?? "Unknown assignee",
        open: 0,
        inProgress: 0,
      };
      if (g.status === "inbox") {
        row.open = prismaGroupCountAll(g);
      } else if (g.status === "in_progress") {
        row.inProgress = prismaGroupCountAll(g);
      }
      workloadByDeveloper.set(g.assigneeDeveloperId, row);
    }
    const workloadRows = Array.from(workloadByDeveloper.values()).sort(
      (a, b) => b.open + b.inProgress - (a.open + a.inProgress) || a.displayName.localeCompare(b.displayName),
    );

    const response = {
      periodLabel,
      monthRange: { from: from.toISOString(), to: to.toISOString() },
      expenses: {
        monthEntryCount,
        byCurrency,
        withReceiptCount: receiptCount,
      },
      planning: {
        total: planningTotal,
        byStatus,
        active: byStatus.active,
        draft: byStatus.draft,
      },
      teams: {
        totalMemberships,
        uniqueDevelopers,
        byTeam,
      },
      ops: {
        openBlockerRisk,
        escalatedOpen,
      },
      workload: {
        rows: workloadRows,
      },
    };
    return response;
  });
}
