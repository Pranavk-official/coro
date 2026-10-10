<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Project rules (full list in CLAUDE.md; spec status in specs/index.md)

- **Types:** `src/types/<module-or-purpose>/<name>.ts` — shared cross-layer types only; types only (no runtime values/enums); no barrel `index.ts`, no loose files in `types/`; import the file with `import type { X } from "@/types/rooms/room"`. Component props stay colocated, module-private types stay in the module, vendor types in `lib/<vendor>/types.ts`, request types come from `z.infer` in `server/module/<x>/<x>.schema.ts`, Socket.IO contracts stay in `lib/socket.io/events.ts`.
- **Imports:** `@/` alias for anything outside the current folder; never `../`.
- **Layout:** Hono backend in `src/server/` (`module/<x>/{routes,service,schema}`), integrations in `src/lib/<vendor>/`, hooks in `src/hooks/`; no server actions.
- **Errors:** throw typed `AppError` subclasses from `src/server/shared/errors.ts` (`BadRequest/Unauthorized/Forbidden/NotFound/Conflict/TooManyRequests/ServiceUnavailable`); never hand-build `c.json({ error })`. One `errorHandler` (`src/server/middlewares/error-handler.ts`, `app.onError`) returns `{ success:false, message, error:{ code, details?, retryAfter? } }` and maps Zod → 400, `HTTPException`, `SyntaxError` → 400, Prisma `P2002`/`P2003` → 409, `P2025` → 404; unknown errors are logged and masked in production. `code` is stable snake_case (`room_full`). Example in CLAUDE.md.
