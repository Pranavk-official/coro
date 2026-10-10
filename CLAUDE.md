# Project rules — socket.io_vc-demo

Video conferencing demo. **Start at `specs/index.md`** (status, checklist, spec-folder rules). Read the feature's `spec.md` + `plan.md` before touching it; tick `tasks.md` as you go and update the index counts in the same change.

## Stack (decided, don't re-litigate)
- Next 16 App Router (`cacheComponents` on). **bun** = package manager/script runner. **Node 24** = runtime; `server.ts` runs via `tsx` (`tsx watch` dev, `node --import tsx` prod) so `@/` resolves outside the bundler.
- Hono inside Next: `src/app/api/[[...route]]/route.ts` via `@hono/vercel` (never `hono/vercel`). All HTTP API under `/api/*`, bodies validated with zod.
- Prisma **pinned `@7`** + Postgres 18. Generator `prisma-client`, output `src/generated/prisma`, `@prisma/adapter-pg`, config in `prisma.config.ts`.
- better-auth: Google + GitHub + magic link + email/password (verified, forgot/reset) + `anonymous` plugin (guests). Mail via `lib/nodemailer` (SMTP; Mailpit in dev). `AUTH_TEST_LOGIN=1` skips verification for Playwright only. Redirect params always pass through `safeNext`.
- Socket.IO on the custom `server.ts` (same origin). **No `output: "standalone"`.**
- WebRTC full mesh, max 10 until spec 005 lands; then **LiveKit SFU** (self-hosted, `lib/livekit`, tokens minted by signaling, Socket.IO stays for app signaling, capacity `ROOM_CAPACITY` default 50). Sign-language captions (spec 004): Python service in `translator/` (FastAPI + MediaPipe + ONNX LSTM), JWT via better-auth `jwt()`; proxied at `/translate/ws` by `server.ts`. HeroUI v3 + Tailwind v4. TanStack Query. MinIO/S3 via `@aws-sdk/client-s3`. Playwright for all test levels.

## Layout
```
prisma/            schema.prisma · migrations/ · seed.ts + seed-config.json
dev/               docker-compose.dev.yml · .env.dev.example · dev-start.sh · dev-stop.sh · dev-db.sh
tests/             Playwright: unit/ · integration/ · e2e/   (tags @regression, @uat)
translator/        Python translation service (own pyproject/Dockerfile; pytest for pure-Python unit tests only — everything cross-process is tested from Playwright)
specs/<nnn-name>/  spec.md · plan.md · tasks.md · tests.md · design.md
src/
  app/             route groups: (auth)/ (call)/ (dashboard)/ · api/[[...route]]/route.ts = thin Hono catch-all (`handle(app)`)
  components/      providers/ (Query, Theme, Toast) · ui/ (HeroUI wrappers, shadcn fallback) · <feature>/
  hooks/           use-*.ts — TanStack Query + client state; API only via `lib/hono/client` (`hc`)
  server/          Hono backend (inside Next)
    app.ts         basePath("/api"), mounts auth + middlewares + routes; exports `app`, `AppType`
    routes/        route definitions — compose modules (`index.ts`)
    module/<x>/    feature modules: <x>.routes.ts · <x>.service.ts · <x>.schema.ts (+ pure helpers)
    middlewares/   session · internal · rate-limit · auth-email-limit · error-handler
    shared/        errors · Hono Env types
  lib/             <vendor>/ one folder per integration: better-auth/ prisma/ hono/(client only) socket.io/ s3/ redis/ nodemailer/ google-drive/ … + non-vendor: webrtc/ calendar/ media-recorder/ rate-limit/ utils/
  types/           <module-or-purpose>/<name>.ts — shared cross-layer types only (see Rules)
  generated/       prisma client (gitignored)
server.ts          custom server (Next + Socket.IO)
```
Flow: `routes/` → `module/<x>.routes.ts` (zod from `<x>.schema.ts`, no Prisma) → `<x>.service.ts` (owns Prisma + lib calls, never touches Hono `c`) → `lib/<vendor>`. Hook → `hc` client → route. Cross-module calls go service → service. Socket server files + `server/module/rooms/join-token.ts` must stay Prisma-free (loaded by `server.ts` without a bundler).

## Rules
- **UX bar: Google-Meet simple** (spec 001 FR18–FR32): meeting codes `abc-defg-hij`, one input for code/link, pre-join before every entry, remembered prefs, no sign-in wall, every screen has one clear next action.
- **No server actions.** Mutations = Hono route + `useMutation`. Server Components may read, not write.
- **HeroUI first**; shadcn only for a primitive HeroUI lacks. Native HTML/CSS before a lib (`<input type="datetime-local">`, CSS grid).
- **Scripts use pacman-style flags**: op letter + modifiers (`-S`, `-Sd`, `-R`, `-Rn`, `-M`, `-B`, `-U <file>`, `-Q`). `-h` always prints usage; unknown flag exits 1; destructive ops prompt `[y/N]`.
- **Types live in `src/types/<module-or-purpose>/<name>.ts`** (e.g. `types/rooms/room.ts`, `types/api/error.ts`, `types/recordings/recording.ts`). Only for types shared across layers (hooks, components, server, lib). Rules: types only — no runtime values, no enums; no barrel `index.ts` and no loose files directly in `types/` (import the file: `import type { PublicRoom } from "@/types/rooms/room"`); `<module>` = the `server/module/<x>` name or a purpose (`api`, `socket`, `media`, `ui`); files are kebab-case singular, types PascalCase without `I` prefix, DTO suffixes `…Body` (request), `…Response`, `Public…`; always `import type`. Not in `types/`: component props (colocate), module-private types (stay in the module file), vendor-internal types (`lib/<vendor>/types.ts`), zod request types (derive with `z.infer` in the module's `*.schema.ts`, don't hand-copy), Socket.IO contracts (`lib/socket.io/events.ts`).
- **Errors:** throw typed errors from `src/server/shared/errors.ts` (`BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `TooManyRequestsError`, `ServiceUnavailableError`, all extending `AppError(status, code, message?, details?)`) — never hand-build `c.json({ error })` in routes/services/middlewares. One central `errorHandler` (`src/server/middlewares/error-handler.ts`, registered with `app.onError`) maps `AppError`, `ZodError` (400), `HTTPException`, `SyntaxError` (400) and Prisma known errors (`P2002`→409, `P2003`→409, `P2025`→404, else 500) to the single envelope `{ success: false, message, error: { code, details?, retryAfter? } }` and hides unknown-error messages in production. `code` = stable snake_case machine code (`room_full`, `rate_limited`); the browser reads it through `ApiError` in `lib/hono/client.ts`. Prisma errors come from `Prisma.PrismaClientKnownRequestError` in `@/generated/prisma/client`. Socket.IO acks use `{ ok:false, error:"<code>" }` with the same codes. Full example below.
- **Imports use `@/` (tsconfig `paths`)** for anything outside the current folder; never `../`. Files loaded by `server.ts` (`src/lib/socket.io/*`, `src/server/module/rooms/join-token.ts`) stay Prisma-free and React-free.
- Redis is for **rate limits + read cache only** (spec 002; `lib/redis`, `lib/rate-limit`); no socket adapter / shared `RoomState` until there is >1 signaling instance. Every new route gets a `rateLimit(...)` line; every new socket event a `socketLimit(...)` guard. React Query is the only client retry policy (`hooks/query-config.ts`). Mesh is built first behind the stable `useCall()` contract (001 plan §11b); the SFU swaps in under it.
- Secrets via env only. `.env.example` / `dev/.env.dev.example` are the contract — update them with every new var.
- Read `node_modules/next/dist/docs/` before Next-specific code (see `AGENTS.md`, regenerated by `next dev`).
- Before implementing: climb the ladder — does it need to exist, is it already here, stdlib, native, installed dep, one line, then code.

## Commands
```
dev/dev-start.sh -S          # db up + migrate + dev server
bun run dev | build | start
bun run test                 # playwright, all projects
bun run test:unit | test:int | test:e2e | test:regression | test:uat
bunx tsc --noEmit && bun run lint
dev/dev-db.sh -M <name> | -B | -U <file> | -Q
```

## Error handling example

```ts
// src/server/shared/errors.ts — typed errors; throw these from services/routes, never `c.json({ error })`
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class AppError extends Error {
  status: ContentfulStatusCode; code: string; details?: unknown;
  constructor(status: ContentfulStatusCode, code: string, message = code, details?: unknown) {
    super(message); this.name = new.target.name; this.status = status; this.code = code; this.details = details;
  }
}
export class BadRequestError extends AppError { constructor(code = "bad_request", message?: string, details?: unknown) { super(400, code, message, details); } }
export class UnauthorizedError extends AppError { constructor(code = "unauthorized", message?: string) { super(401, code, message); } }
export class ForbiddenError extends AppError { constructor(code = "forbidden", message?: string) { super(403, code, message); } }
export class NotFoundError extends AppError { constructor(code = "not_found", message?: string) { super(404, code, message); } }
export class ConflictError extends AppError { constructor(code = "conflict", message?: string) { super(409, code, message); } }
export class TooManyRequestsError extends AppError {
  retryAfter: number;
  constructor(code = "rate_limited", retryAfter = 1, message?: string) { super(429, code, message); this.retryAfter = retryAfter; }
}
export class ServiceUnavailableError extends AppError { constructor(code = "unavailable", message?: string) { super(503, code, message); } }
```

```ts
// src/server/middlewares/error-handler.ts — registered once: `app.onError(errorHandler)` in server/app.ts
import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { AppError, TooManyRequestsError } from "@/server/shared/errors";

const PRISMA: Record<string, [ContentfulStatusCode, string, string]> = {
  P2002: [409, "unique_violation", "Already exists"],
  P2003: [409, "foreign_key_violation", "Related record conflict"],
  P2025: [404, "not_found", "Record not found"],
};
const body = (message: string, code: string, extra: object = {}) => ({ success: false as const, message, error: { code, ...extra } });

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    if (err instanceof TooManyRequestsError) c.header("Retry-After", String(err.retryAfter));
    const extra = err instanceof TooManyRequestsError ? { retryAfter: err.retryAfter } : err.details ? { details: err.details } : {};
    return c.json(body(err.message, err.code, extra), err.status);
  }
  if (err instanceof ZodError) return c.json(body("Validation failed", "validation_failed", { details: err.issues }), 400);
  if (err instanceof HTTPException) return c.json(body(err.message, "http_error"), err.status);
  if (err instanceof SyntaxError) return c.json(body("Invalid JSON", "invalid_json"), 400);
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const [status, code, message] = PRISMA[err.code] ?? [500, "database_error", "Database error"];
    if (status === 500) console.error("[db]", err.code, err.message);
    return c.json(body(message, code), status);
  }
  console.error("[unhandled]", err);                                  // always logged; stack only in dev output
  return c.json(body(process.env.NODE_ENV === "production" ? "Internal server error" : err.message, "internal_error"), 500);
};
```
Response envelope for **every** HTTP error: `{ success: false, message, error: { code, details?, retryAfter? } }`. `code` is a stable snake_case machine code the client switches on (`room_full`, `rate_limited`, …); `message` is human text.
