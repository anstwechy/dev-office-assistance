import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import type { Env } from "../env.js";
import { requireDbUser } from "../userService.js";

const SETTINGS_ID = "default" as const;

const uuidOrEmpty = z
  .string()
  .trim()
  .refine((s) => s === "" || z.string().uuid().safeParse(s).success, { message: "invalid_uuid" });

const putM365 = z
  .object({
    tenantId: z
      .union([z.string(), z.undefined(), z.null()])
      .transform((s) => (s == null ? "" : String(s).trim()))
      .pipe(uuidOrEmpty),
    clientId: z
      .union([z.string(), z.undefined(), z.null()])
      .transform((s) => (s == null ? "" : String(s).trim()))
      .pipe(uuidOrEmpty),
  })
  .refine(
    (b) => {
      const t = b.tenantId;
      const c = b.clientId;
      if (t === "" && c === "") return true;
      if (t !== "" && c !== "") return true;
      return false;
    },
    { message: "tenant_and_client_both_or_clear", path: ["tenantId"] },
  );

function mergeM365(
  row: { tenantId: string | null; clientId: string | null } | null,
  env: Env,
): { tenantId: string; clientId: string; configured: boolean; fromDatabase: boolean } {
  const eT = env.M365_TENANT_ID?.trim() ?? "";
  const eC = env.M365_CLIENT_ID?.trim() ?? "";
  const t = (row?.tenantId?.trim() || eT) ?? "";
  const c = (row?.clientId?.trim() || eC) ?? "";
  const fromDatabase = Boolean(row?.tenantId?.trim() && row?.clientId?.trim());
  return {
    tenantId: t,
    clientId: c,
    configured: Boolean(t && c),
    fromDatabase,
  };
}

export async function registerM365IntegrationsRoutes(app: FastifyInstance, env: Env) {
  app.get("/api/integrations/m365", async (request, reply) => {
    const auth = request.authUser;
    const me = await requireDbUser(auth, reply);
    if (!me) return;

    const row = await prisma.m365AppSettings.findUnique({ where: { id: SETTINGS_ID } });
    const m = mergeM365(row, env);
    return {
      tenantId: m.tenantId,
      clientId: m.clientId,
      configured: m.configured,
      /** True when both IDs are stored in the database (not only from server env). */
      fromDatabase: m.fromDatabase,
    };
  });

  app.put("/api/integrations/m365", async (request, reply) => {
    const auth = request.authUser;
    const me = await requireDbUser(auth, reply);
    if (!me) return;

    if (me.role !== "lead") {
      return reply.status(403).send({ error: "forbidden", message: "Only lead users can change app registration." });
    }

    const parsed = putM365.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "validation", details: parsed.error.flatten() });
    }
    const { tenantId, clientId } = parsed.data;

    if (tenantId === "" && clientId === "") {
      await prisma.m365AppSettings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, tenantId: null, clientId: null },
        update: { tenantId: null, clientId: null },
      });
    } else {
      await prisma.m365AppSettings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, tenantId, clientId },
        update: { tenantId, clientId },
      });
    }

    const row = await prisma.m365AppSettings.findUnique({ where: { id: SETTINGS_ID } });
    const m = mergeM365(row, env);
    return {
      tenantId: m.tenantId,
      clientId: m.clientId,
      configured: m.configured,
      fromDatabase: Boolean(row?.tenantId?.trim() && row?.clientId?.trim()),
    };
  });
}
