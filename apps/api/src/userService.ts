import type { FastifyReply } from "fastify";
import { prisma } from "./db.js";
import type { AuthUser } from "./auth.js";
import type { User } from "@prisma/client";

/** Load the DB user for an authenticated request, or end the request with 401. */
export async function requireDbUser(
  auth: AuthUser | undefined,
  reply: FastifyReply,
): Promise<User | null> {
  if (!auth) {
    await reply.status(401).send({ error: "unauthorized" });
    return null;
  }
  const user = await prisma.user.findUnique({ where: { id: auth.id } });
  if (!user) {
    await reply.status(401).send({ error: "user_not_found" });
    return null;
  }
  return user;
}
