# Office dev triage

Internal tool for a **dev leadership triage inbox** (blockers, risks, quality, process). **v1 uses two seeded local users** (email + password). **Microsoft 365 (Outlook import, To Do read)** is optional under **Apps** in the web UI.

## Sign-in (v1)

- **Local accounts** stored in PostgreSQL (bcrypt passwords, JWT sessions). No Microsoft account required to use the app.
- **Default seeded users** (after `npm run db:seed` — change passwords in production):

  | Email               | Default password   |
  |---------------------|--------------------|
  | `lead@local.dev`    | `ChangeMe!Lead1`   |
  | `assistant@local.dev` | `ChangeMe!Asst1` |

  Override via `SEED_LEAD_PASSWORD` / `SEED_ASSISTANT_PASSWORD` in the environment when seeding.

## Optional: Microsoft 365 (Apps)

The **Apps** section uses MSAL in the browser to get a **Microsoft Graph** access token and sends it to the API on the `X-Graph-Access-Token` header (core login stays local JWT). **Entra (tenant) ID** and **application (client) ID** are read at runtime from `GET /api/integrations/m365`, which returns values stored in the database (a **lead** can edit them under **App registration** in the web UI) or, if the database is empty, from the API **server** environment: `M365_TENANT_ID` and `M365_CLIENT_ID`. In Entra, register a **single-page application** with redirect URI = your web origin and delegated **Microsoft Graph** permissions: `User.Read`, `Mail.Read` (Outlook import), and `Tasks.ReadWrite` (To Do).

## Stack

- **Web:** React (Vite), TanStack Query, React Router; MSAL on Outlook/To Do app pages when configured
- **API:** Node, Fastify, Prisma, PostgreSQL, `jose` (HS256 JWT), `bcryptjs`
- **Infra:** Docker Compose (postgres + api + optional static `web` on 8080)

## Prerequisites

- Node 20+, npm 10+
- PostgreSQL (or Docker only for Postgres)

## Local development

1. Copy [`.env.example`](.env.example) → `.env` at the repo root. Set **`AUTH_JWT_SECRET`** (≥ 32 characters).

2. Copy [`apps/web/.env.example`](apps/web/.env.example) → `apps/web/.env` (optional `VITE_API_BASE_URL` for API origin; Microsoft IDs are not required in the web bundle).

3. Start Postgres and run migrations + seed:

   ```bash
   docker compose up postgres -d
   npm install
   npm run prisma:generate -w @office/api
   npm run db:migrate -w @office/api
   npm run db:seed
   ```

4. Run API and web (from repo root):

   ```powershell
   # PowerShell — set env for the API process
   $env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/office_assistance"
   $env:AUTH_JWT_SECRET="your-at-least-32-character-secret-here"
   $env:CORS_ORIGIN="http://localhost:5173"
   npm run dev -w @office/api
   ```

   ```bash
   npm run dev -w @office/web
   ```

   Or use `npm run dev` from the root to run both.

5. Open **http://localhost:5173** and sign in with a seeded user.

The Vite dev server proxies `/api` to `http://localhost:4000` when `VITE_API_BASE_URL` is empty.

## Docker Compose

1. Create `.env` at the repo root with at least:

   ```env
   AUTH_JWT_SECRET=your-long-random-secret-at-least-32-characters
   ```

2. `npm run docker:up` (or `docker compose up --build -d`).

3. Run migrations and seed **inside** or from the host against the same `DATABASE_URL` (see above). The API container does not auto-seed.

4. UI: **http://localhost:8080** (if `web` service is built), API: **http://localhost:4000/healthz**.

## npm: `SELF_SIGNED_CERT_IN_CHAIN` (corporate SSL inspection)

If `npm install` fails with certificate errors, your network is likely inspecting HTTPS. Set `NODE_EXTRA_CA_CERTS` or `npm config set cafile` to your organization’s root CA PEM. See section in project history or standard Node/npm corporate documentation.

## Security notes

- Rotate **AUTH_JWT_SECRET** and seeded passwords for any shared or production deployment.
- Email import stores message metadata and links, not full bodies, by design.

## Project layout

| Path | Purpose |
|------|---------|
| [`apps/web`](apps/web) | React SPA |
| [`apps/api`](apps/api) | Fastify API + Prisma + seed |
| [`packages/types`](packages/types) | Shared DTO types |
