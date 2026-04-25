import type { FastifyInstance } from "fastify";
import type { DevTeam, PlanningStatus } from "@prisma/client";
import { prisma } from "../db.js";
import { requireDbUser } from "../userService.js";

const ALL_PLANNING: PlanningStatus[] = ["draft", "active", "done", "cancelled"];

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

    const openWhere = { status: { notIn: ["done", "dropped"] as const } } as const;

    const [byCurrencyRows, monthEntryCount, receiptCount, planGroups, teamGroups, teamUserRows, openBlockerRisk, escalatedOpen, devs, triageByAssignee] =
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
        prisma.developer.findMany({
          select: { id: true, displayName: true },
          orderBy: { displayName: "asc" },
        }),
        prisma.triageItem.groupBy({
          by: ["assigneeDeveloperId", "status"],
          where: openWhere,
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
      byStatus[g.status] = g._count._all;
    }
    const planningTotal = ALL_PLANNING.reduce((acc, s) => acc + byStatus[s], 0);

    const byTeam: Record<DevTeam, number> = {
      backend: 0,
      qa: 0,
      frontend_web: 0,
      frontend_mobile: 0,
    };
    for (const g of teamGroups) {
      byTeam[g.team] = g._count._all;
    }
    const totalMemberships = teamGroups.reduce((acc, g) => acc + g._count._all, 0);
    const uniqueDevelopers = new Set(teamUserRows.map((r) => r.developerId)).size;

    const byDev = new Map<string, { open: number; inProgress: number }>();
    for (const d of devs) {
      byDev.set(d.id, { open: 0, inProgress: 0 });
    }
    for (const row of triageByAssignee) {
      const cur = byDev.get(row.assigneeDeveloperId) ?? { open: 0, inProgress: 0 };
      const n = row._count._all;
      if (row.status === "in_progress") {
        cur.inProgress += n;
      }
      if (row.status === "inbox" || row.status === "in_progress" || row.status === "snoozed") {
        cur.open += n;
      }
      byDev.set(row.assigneeDeveloperId, cur);
    }
    const workloadRows = devs.map((d) => {
      const c = byDev.get(d.id) ?? { open: 0, inProgress: 0 };
      return {
        developerId: d.id,
        displayName: d.displayName,
        open: c.open,
        inProgress: c.inProgress,
      };
    });

    return {
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
  });
}
