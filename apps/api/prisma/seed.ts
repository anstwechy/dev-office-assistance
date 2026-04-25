import { PrismaClient, type DevTeam } from "@prisma/client";

import bcrypt from "bcryptjs";

import { MASARAT_ROSTER, parseHireDate } from "./roster-seed-data.js";

const prisma = new PrismaClient();

export const SEED_DEV_IDS = {
  lead: "00000000-0000-4000-8000-000000000001",
  assistant: "00000000-0000-4000-8000-000000000002",
} as const;

async function seedTeamMembership(developerId: string, team: DevTeam, isTeamLead: boolean) {
  await prisma.teamMembership.upsert({
    where: { developerId_team: { developerId, team } },
    create: { developerId, team, isTeamLead },
    update: { isTeamLead },
  });
}

async function main() {
  const passwordLead = process.env.SEED_LEAD_PASSWORD ?? "lead";
  const passwordAsst = process.env.SEED_ASSISTANT_PASSWORD ?? "ChangeMe!Asst1";
  const h1 = await bcrypt.hash(passwordLead, 10);
  const h2 = await bcrypt.hash(passwordAsst, 10);

  await prisma.user.upsert({
    where: { email: "lead@local.dev" },
    create: {
      email: "lead@local.dev",
      passwordHash: h1,
      displayName: "أنس جمال سالم المصباحي",
      role: "lead",
    },
    update: {
      passwordHash: h1,
      displayName: "أنس جمال سالم المصباحي",
    },
  });

  await prisma.user.upsert({
    where: { email: "assistant@local.dev" },
    create: {
      email: "assistant@local.dev",
      passwordHash: h2,
      displayName: "فيروز عادل محمد بشير",
      role: "assistant",
    },
    update: {
      passwordHash: h2,
      displayName: "فيروز عادل محمد بشير",
    },
  });

  const devCount = await prisma.developer.count();
  if (devCount > 0) {
    console.log("Developers table already has rows; skipping roster + team seed (use a fresh db or reset).");
  } else {
    for (const row of MASARAT_ROSTER) {
      const dev = await prisma.developer.create({
        data: {
          ...(row.id ? { id: row.id } : {}),
          displayName: row.displayName,
          workEmail: row.workEmail,
          phone: row.phone,
          jobTitle: row.jobTitle,
          skills: row.skills,
          tenureLabel: row.tenureLabel,
          hireDate: parseHireDate(row.hireRaw),
          rosterPosition: row.rosterPosition,
        },
      });
      if (row.team) {
        await seedTeamMembership(dev.id, row.team, row.isTeamLead);
      }
    }
    console.log(`Seeded ${MASARAT_ROSTER.length} developers and their team assignments.`);
  }

  console.log("Sign-in accounts: lead@local.dev, assistant@local.dev (SEED_LEAD_PASSWORD / SEED_ASSISTANT_PASSWORD).");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
