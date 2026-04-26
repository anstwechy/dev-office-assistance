import { SignJWT, jwtVerify } from "jose";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Env } from "./env.js";

const JWT_ALG = "HS256";

export type AuthUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  accessToken: string;
};

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

function getJwtSecretKey(env: Env) {
  return new TextEncoder().encode(env.AUTH_JWT_SECRET);
}

export async function signUserAccessToken(
  env: Env,
  user: { id: string; email: string; displayName: string | null },
  expires: string = "7d",
): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.displayName,
  })
    .setProtectedHeader({ alg: JWT_ALG })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(getJwtSecretKey(env));
}

export function createAuthPlugin(env: Env) {
  const key = getJwtSecretKey(env);

  return async function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "missing_bearer_token" });
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      return reply.status(401).send({ error: "empty_token" });
    }

    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: [JWT_ALG],
      });

      const sub = payload.sub;
      if (typeof sub !== "string" || !sub) {
        return reply.status(401).send({ error: "invalid_subject" });
      }

      const email = typeof payload.email === "string" ? payload.email : null;
      const name =
        typeof payload.name === "string"
          ? payload.name
          : null;

      request.authUser = {
        id: sub,
        email,
        displayName: name,
        accessToken: token,
      };
    } catch {
      return reply.status(401).send({ error: "invalid_token" });
    }
  };
}
