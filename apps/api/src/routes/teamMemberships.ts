import type { FastifyInstance } from "fastify";

import { z } from "zod";

import type { DevTeam, Prisma, RosterPosition } from "@prisma/client";

import { prisma } from "../db.js";

import { requireDbUser } from "../userService.js";



const teamZ = z.enum(["backend", "qa", "frontend_web", "frontend_mobile"]);



const postBody = z.object({

  developerId: z.string().min(1),

  team: teamZ,

  isTeamLead: z.boolean().optional(),

});



const patchBody = z.object({

  isTeamLead: z.boolean().optional(),

});



const developerSummarySelect = {

  id: true,

  displayName: true,

  skills: true,

  workEmail: true,

  phone: true,

  location: true,

  bio: true,

  skillDetails: true,

  achievements: true,

  jobTitle: true,

  hireDate: true,

  tenureLabel: true,

  rosterPosition: true,

} as const;



function hireDateToDto(d: Date | null) {

  if (d == null) return null;

  return d.toISOString().slice(0, 10);

}



function toDto(m: {

  id: string;

  developerId: string;

  team: DevTeam;

  isTeamLead: boolean;

  createdAt: Date;

  developer: {

    id: string;

    displayName: string;

    skills: string | null;

    workEmail: string | null;

    phone: string | null;

    location: string | null;

    bio: string | null;

    skillDetails: string | null;

    achievements: string | null;

    jobTitle: string | null;

    hireDate: Date | null;

    tenureLabel: string | null;

    rosterPosition: RosterPosition;

  };

}) {

  return {

    id: m.id,

    team: m.team,

    developerId: m.developerId,

    isTeamLead: m.isTeamLead,

    createdAt: m.createdAt.toISOString(),

    developer: {

      id: m.developer.id,

      displayName: m.developer.displayName,

      skills: m.developer.skills,

      workEmail: m.developer.workEmail,

      phone: m.developer.phone,

      location: m.developer.location,

      bio: m.developer.bio,

      skillDetails: m.developer.skillDetails,

      achievements: m.developer.achievements,

      jobTitle: m.developer.jobTitle,

      hireDate: hireDateToDto(m.developer.hireDate),

      tenureLabel: m.developer.tenureLabel,

      rosterPosition: m.developer.rosterPosition,

    },

  };

}



export async function registerTeamMembershipRoutes(app: FastifyInstance) {

  app.get("/api/team-memberships", async (request, reply) => {

    const auth = request.authUser;

    const me = await requireDbUser(auth, reply);

    if (!me) return;



    const q = request.query as Record<string, string | undefined>;

    const where: Prisma.TeamMembershipWhereInput = {};

    if (q.team) {

      const t = teamZ.safeParse(q.team);

      if (!t.success) {

        return reply.status(400).send({ error: "invalid_team" });

      }

      where.team = t.data;

    }



    const rows = await prisma.teamMembership.findMany({
      where,
      include: {
        developer: { select: developerSummarySelect },
      },
      orderBy: { team: "asc" },
    });

    const sorted = [...rows].sort((a, b) => {
      const byTeam = a.team.localeCompare(b.team);
      if (byTeam !== 0) return byTeam;
      if (a.isTeamLead !== b.isTeamLead) return a.isTeamLead ? -1 : 1;
      return a.developer.displayName.localeCompare(b.developer.displayName, undefined, { sensitivity: "base" });
    });

    return { memberships: sorted.map((r) => toDto(r)) };

  });



  app.post("/api/team-memberships", async (request, reply) => {

    const auth = request.authUser;

    const me = await requireDbUser(auth, reply);

    if (!me) return;

    const parsed = postBody.safeParse(request.body);

    if (!parsed.success) {

      return reply.status(400).send({ error: "validation", details: parsed.error.flatten() });

    }

    const { developerId, team, isTeamLead } = parsed.data;



    const target = await prisma.developer.findUnique({ where: { id: developerId } });

    if (!target) {

      return reply.status(400).send({ error: "developer_not_found" });

    }



    const existing = await prisma.teamMembership.findUnique({

      where: { developerId_team: { developerId, team: team as DevTeam } },

    });

    if (existing) {

      return reply.status(409).send({ error: "already_member" });

    }



    const m = await prisma.teamMembership.create({

      data: { developerId, team: team as DevTeam, isTeamLead: isTeamLead ?? false },

      include: {

        developer: { select: developerSummarySelect },

      },

    });

    return reply.status(201).send(toDto(m));

  });



  app.patch("/api/team-memberships/:id", async (request, reply) => {

    const auth = request.authUser;

    const me = await requireDbUser(auth, reply);

    if (!me) return;

    const { id } = request.params as { id: string };

    const parsed = patchBody.safeParse(request.body);

    if (!parsed.success) {

      return reply.status(400).send({ error: "validation", details: parsed.error.flatten() });

    }

    const existing = await prisma.teamMembership.findUnique({ where: { id } });

    if (!existing) {

      return reply.status(404).send({ error: "not_found" });

    }

    const m = await prisma.teamMembership.update({

      where: { id },

      data: {

        ...(parsed.data.isTeamLead !== undefined ? { isTeamLead: parsed.data.isTeamLead } : {}),

      },

      include: {

        developer: { select: developerSummarySelect },

      },

    });

    return toDto(m);

  });



  app.delete("/api/team-memberships/:id", async (request, reply) => {

    const auth = request.authUser;

    const me = await requireDbUser(auth, reply);

    if (!me) return;

    const { id } = request.params as { id: string };

    const row = await prisma.teamMembership.findUnique({ where: { id } });

    if (!row) {

      return reply.status(404).send({ error: "not_found" });

    }

    await prisma.teamMembership.delete({ where: { id } });

    return reply.status(204).send();

  });

}


