import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { requireDbUser } from "../userService.js";

export async function registerUsersRoutes(app: FastifyInstance) {
  app.get("/api/users", async (request, reply) => {
    const auth = request.authUser;
    const me = await requireDbUser(auth, reply);
    if (!me) return;
    const users = await prisma.user.findMany({
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
      },
    });
    return { users };
  });
}
