import type { Metadata } from "next";
import DocPage from "@/components/docs/DocPage";
import Code from "@/components/docs/CodeBlock";
import { C, H2, Note, Step, Steps } from "@/components/docs/prose";
import { SITE } from "@/lib/utils/site";

export const metadata: Metadata = { title: "Local development · Docs", description: "Run Coro locally and work on it." };

const LAYOUT = `src/app/          routes: (auth) (call) (dashboard) (legal) docs/, api/[[...route]] = Hono catch-all
src/components/   UI by feature: call/ lobby/ auth/ profile/ docs/ layout/ ui/
src/hooks/        TanStack Query hooks + client state (use-*.ts)
src/server/       Hono API: app.ts, routes/, module/<name>/{routes,service,schema}, middlewares/, shared/errors
src/lib/          one folder per integration: better-auth prisma socket.io redis s3 webrtc google-drive …
src/types/        types shared across layers only
server.ts         custom Node server: Next.js + Socket.IO signaling on one port
prisma/           schema and migrations
tests/            Playwright: unit/ integration/ e2e/ showcase/
deploy/           Caddy, nginx and TURN configs (shown verbatim in these docs)`;

export default function Page() {
  return (
    <DocPage href="/docs/contributing/development">
      <H2 id="setup">Set up</H2>
      <p>You need Node.js 24, <a href="https://bun.sh" target="_blank" rel="noopener noreferrer">Bun</a> and Docker with Compose.</p>
      <Steps>
        <Step title="Fork and clone">
          <Code code={`git clone https://github.com/<you>/coro.git\ncd coro\nbun install`} />
        </Step>
        <Step title="Configure">
          <p>The dev defaults work as they are. Google and GitHub keys are optional; their buttons only show when set.</p>
          <Code code={`cp dev/.env.dev.example .env`} />
        </Step>
        <Step title="Start everything">
          <p>Postgres, MinIO, Redis and Mailpit in Docker, then migrations, then the dev server with live reload.</p>
          <Code code={`./dev/dev-start.sh -S`} />
        </Step>
        <Step title="Sign up">
          <p>
            Open <C>http://localhost:3000</C> and create an account. The verification mail lands in Mailpit at{" "}
            <C>http://localhost:18025</C>. Use a second browser profile, or a guest in a private window, to test a call
            with yourself.
          </p>
        </Step>
      </Steps>

      <H2 id="scripts">Dev scripts</H2>
      <p>
        Scripts in <C>dev/</C> use pacman-style flags: one operation letter plus modifiers. <C>-h</C> prints usage,
        unknown flags exit 1, and anything destructive asks first.
      </p>
      <Code
        code={`dev/dev-start.sh -Sd       # services only, in the background\ndev/dev-stop.sh -R         # stop everything\ndev/dev-stop.sh -Rn        # stop and delete the data volumes\ndev/dev-db.sh -Q           # migration status\ndev/dev-db.sh -Qs          # Prisma Studio\ndev/dev-db.sh -Qm          # Mailpit URL\ndev/dev-db.sh -Qr          # Redis stats and rate-limit counters\ndev/dev-db.sh -B           # back up the dev database`}
      />

      <H2 id="layout">Code layout</H2>
      <Code lang="plaintext" title="repository" code={LAYOUT} />
      <p>
        A request goes <strong>hook → typed <C>hc</C> client → Hono route (zod) → service (Prisma + libs)</strong>. Routes
        never touch Prisma and services never touch the Hono context. In a call, audio and video go directly between
        browsers over WebRTC; the server only relays signaling through Socket.IO.
      </p>

      <H2 id="database">Database changes</H2>
      <p>Edit <C>prisma/schema.prisma</C>, then:</p>
      <Code code={`dev/dev-db.sh -M add-something   # creates the migration and regenerates the client`} />
      <Note>Commit the new migration folder with your change. Never edit a migration that is already merged; add another one.</Note>

      <H2 id="tests">Tests</H2>
      <p>Every level runs on Playwright, and the browser tests use Chromium&apos;s fake camera and microphone, so they need no hardware.</p>
      <Code
        code={`bun run test            # everything, about 3 minutes\nbun run test:unit       # pure functions\nbun run test:int        # API and sockets against a running server\nbun run test:e2e        # browser flows\nbunx tsc --noEmit && bun run lint`}
      />
      <p>
        Changed something visible? Refresh the screenshots, then copy the ones these docs use into <C>public/docs/</C>.
      </p>
      <Code code={`bun run screenshots     # writes docs/screenshots/ for desktop, iPad and iPhone, light and dark`} />
      <p>
        Read the <a href="/docs/contributing">contributing guide</a> before opening a pull request, and{" "}
        <a href={`${SITE.repo}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noopener noreferrer">CONTRIBUTING.md</a> for
        the same in the repo.
      </p>
    </DocPage>
  );
}
