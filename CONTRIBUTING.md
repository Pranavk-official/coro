# Contributing to Coro

Thanks for helping. Coro is a self-hosted video calling app that tries to feel as simple as Google Meet: one link,
nothing to install, the host decides who gets in. Every change is measured against that.

The same guide, with the full setup walkthrough, is in the docs at `/docs/contributing` on any running instance.

## Ways to help

- **Report a bug.** Open an [issue](https://github.com/Pranavk-official/coro/issues/new/choose) with steps to reproduce,
  what you expected, and your browser and OS. Calls are timing-sensitive, so say whether it happens every time.
- **Suggest a feature.** Open an issue first and describe the problem before the solution. Features need a short
  design note before code, and some ideas are already planned.
- **Fix something.** Issues labelled `good first issue` are small and self-contained. Comment on one so nobody else
  picks it up.
- **Improve the docs.** The self-hosting guides live in `src/app/docs/`. Corrections from people who actually deployed
  Coro are the most valuable kind.

**Security problems:** don't open a public issue. Email pranavkcse@gmail.com with the details, and you'll get a reply
within a few days.

## Set up

You need Node.js 24, [Bun](https://bun.sh) and Docker with Compose.

```bash
git clone https://github.com/<you>/coro.git && cd coro
bun install
cp dev/.env.dev.example .env    # the defaults work as they are
./dev/dev-start.sh -S           # Postgres, MinIO, Redis and Mailpit; migrations; dev server
```

Open <http://localhost:3000>. Sign-in emails land in Mailpit at <http://localhost:18025>. Google and GitHub sign-in
are optional; the buttons only show when their keys are set.

Scripts in `dev/` use pacman-style flags: `-h` prints usage, `-Sd` starts services only, `dev-stop.sh -R` stops
them, `dev-db.sh -M <name>` creates a migration. See the README for the full table.

## How the code is laid out

```
src/app/          Next.js routes: (auth) (call) (dashboard) (legal) docs/, api/[[...route]] (Hono catch-all)
src/components/   UI by feature: call/ lobby/ auth/ profile/ docs/ layout/ ui/
src/hooks/        TanStack Query hooks + client state (use-*.ts)
src/server/       Hono API: app.ts, routes/, module/<name>/{routes,service,schema}, middlewares/, shared/errors
src/lib/          one folder per integration (better-auth, prisma, socket.io, redis, s3, webrtc, …)
src/types/        types shared across layers only
server.ts         custom Node server: Next.js + Socket.IO signaling on one port
prisma/           schema and migrations
tests/            Playwright: unit/ integration/ e2e/ showcase/
deploy/           Caddy, nginx and TURN configs (shown verbatim in the docs)
```

A request goes **hook → typed `hc` client → Hono route (zod) → service (Prisma + libs)**. Routes never touch Prisma;
services never touch the Hono context. Calls in the browser use WebRTC directly between peers; the server only
relays signaling over Socket.IO.

## Conventions

These keep the codebase consistent. Review will point at them, so it's quicker to follow them up front.

- **UI:** HeroUI v3 components first, Tailwind for the rest, theme tokens instead of raw colours. Check every UI change
  at 375 px wide and in both light and dark themes. Keep the Meet-simple bar: every screen has one clear next action.
- **No server actions.** Mutations are a Hono route plus `useMutation`. Server Components may read, not write.
- **Errors:** throw the typed errors from `src/server/shared/errors.ts` (`BadRequestError`, `NotFoundError`, …).
  The central `errorHandler` turns them into `{ success: false, message, error: { code } }`. Never hand-build an error
  response. `code` is a stable snake_case string the client switches on.
- **Validation:** every request body goes through zod in the module's `*.schema.ts`; derive types with `z.infer`.
- **Limits:** every new route gets a `rateLimit(...)` and every new socket event a `socketLimit(...)` guard.
- **Imports:** use `@/` for anything outside the current folder, never `../`. Files loaded by `server.ts`
  (`src/lib/socket.io/*`, `src/server/module/rooms/join-token.ts`) must stay free of Prisma and React.
- **Types:** shared ones go in `src/types/<module>/<name>.ts` (types only, no barrel files, `import type`). Component
  props and module-private types stay next to their code.
- **Environment:** a new variable goes into both `.env.example` and `dev/.env.dev.example`, with a one-line comment.
- **Before writing code:** check whether it needs to exist, whether something here already does it, and whether the
  platform or an installed dependency covers it. Smaller is better.
- **Next.js:** this is Next 16 with `cacheComponents` on, which differs from older versions. Read the bundled docs in
  `node_modules/next/dist/docs/` before Next-specific work.

## Database changes

```bash
dev/dev-db.sh -M add-something   # edit prisma/schema.prisma first; creates the migration and regenerates the client
```

Commit the generated migration folder with your change. Never edit a migration that has already been merged; add a
new one. Migrations run automatically when the app starts.

## Tests

Every level runs on Playwright. End-to-end tests use Chromium's fake camera and microphone.

```bash
bun run test            # everything (about 3 minutes)
bun run test:unit       # pure functions
bun run test:int        # API and sockets against a running server
bun run test:e2e        # browser flows
bunx tsc --noEmit && bun run lint
```

- Add or update a test for every behaviour you change. Tag tests that guard existing behaviour `@regression` and
  user-story tests `@uat`.
- Prefer real flows over mocks. Mock only what you can't run locally (Google Drive, real OAuth).
- Changed something visible? Run `bun run screenshots` to refresh `docs/screenshots/`, and copy the ones the docs use
  into `public/docs/`.

## Commits and pull requests

- Branch from `main`. Keep a pull request to one change; small ones get reviewed faster.
- Use [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`,
  `chore:`, with an optional scope, as in `fix(call): keep the pin button clear of the self-view`.
- Fill in the pull request template: what changed, why, how you tested it, and screenshots for UI changes.
- Before you open it: `bunx tsc --noEmit`, `bun run lint` and `bun run test` pass, and docs and `.env.example` are
  updated if behaviour or settings changed.

## License

Coro is [MIT-licensed](LICENSE). By contributing you agree that your contribution is released under the same license.
