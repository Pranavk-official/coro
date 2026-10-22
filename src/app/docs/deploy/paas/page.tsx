import type { Metadata } from "next";
import DocPage from "@/components/docs/DocPage";
import Code from "@/components/docs/CodeBlock";
import { C, H2, H3, Note, Step, Steps } from "@/components/docs/prose";
import { START } from "@/lib/docs/snippets";

export const metadata: Metadata = { title: "Railway, Render, Fly.io · Docs", description: "Run just the Coro container with managed Postgres and Redis." };

const FLY_TOML = `app = "coro"
primary_region = "sin"

[build]
  [build.args]
    BETTER_AUTH_URL = "https://coro.fly.dev"

[deploy]
  release_command = "bunx prisma migrate deploy"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "off"   # calls are long-lived connections
  auto_start_machines = true
  min_machines_running = 1

  [[http_service.checks]]
    method = "GET"
    path = "/robots.txt"
    interval = "30s"
    timeout = "5s"
    grace_period = "20s"`;

const R2_ENV = `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY=<r2 access key id>
S3_SECRET_KEY=<r2 secret access key>
S3_BUCKET=coro
S3_PUBLIC_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`;

export default function Page() {
  return (
    <DocPage
      href="/docs/deploy/paas"
    >
      <Note tone="warn" title="Run exactly one instance">
        Rooms and signaling live in the app&apos;s memory, so a second replica would split calls in two. Turn off autoscaling
        and scale-to-zero, since calls are long-lived connections. These platforms don&apos;t forward the UDP port range TURN
        needs: for a relay, run coturn on a small VPS and point <C>TURN_HOST</C> at it.
      </Note>

      <H2 id="common">What every platform needs</H2>
      <Steps>
        <Step title="A Postgres and a Redis">
          <p>Add the platform&apos;s own and copy their connection strings into <C>DATABASE_URL</C> and <C>REDIS_URL</C>.</p>
        </Step>
        <Step title="An S3 bucket">
          <p>Cloudflare R2, Backblaze B2 or AWS S3. Create the bucket first; for R2:</p>
          <Code lang="dotenv" title="storage variables" code={R2_ENV} />
        </Step>
        <Step title="Build from the Dockerfile">
          <p><C>BETTER_AUTH_URL</C> is also a build argument (it&apos;s baked into page metadata), so it must be set before the first build.</p>
        </Step>
        <Step title="Migrate on start">
          <p>The image doesn&apos;t migrate on its own. Use this start command, or run <C>bunx prisma migrate deploy</C> as a release / pre-deploy command:</p>
          <Code code={START} />
        </Step>
        <Step title="Health check and proxy">
          <p>Health check path <C>/robots.txt</C>, and set <C>TRUST_PROXY=1</C>. The rest of the variables are the same as the <a href="/docs/configuration">reference</a>.</p>
        </Step>
      </Steps>

      <H2 id="railway">Railway</H2>
      <Steps>
        <Step title="Create the project">
          <p><strong>New Project → Deploy from GitHub repo</strong>, then <strong>+ New → Database</strong> for PostgreSQL and Redis.</p>
        </Step>
        <Step title="Variables">
          <p>Reference the databases instead of pasting their URLs, then add the rest. Railway passes service variables to the Docker build, so <C>BETTER_AUTH_URL</C> reaches it.</p>
          <Code lang="dotenv" title="app → Variables" code={"DATABASE_URL=${{Postgres.DATABASE_URL}}\nREDIS_URL=${{Redis.REDIS_URL}}\nBETTER_AUTH_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}"} />
        </Step>
        <Step title="Start command and domain">
          <p><strong>Settings → Deploy → Custom Start Command</strong>: the start command above. <strong>Settings → Networking → Generate Domain</strong> (or add your own), port <C>3000</C>. Keep replicas at 1.</p>
        </Step>
      </Steps>

      <H2 id="render">Render</H2>
      <Steps>
        <Step title="Databases">
          <p>Create a <strong>Postgres</strong> and a <strong>Key Value</strong> (Redis-compatible) instance in the same region.</p>
        </Step>
        <Step title="Web service">
          <p><strong>New → Web Service</strong> from the repo, language <strong>Docker</strong>, a paid instance type (free instances sleep and drop calls). Put the start command above in <strong>Docker Command</strong>.</p>
        </Step>
        <Step title="Environment">
          <p>Add the variables, using the internal URLs of the two databases. Health check path <C>/robots.txt</C>.</p>
        </Step>
      </Steps>

      <H2 id="fly">Fly.io</H2>
      <Code lang="toml" title="fly.toml" code={FLY_TOML} />
      <H3>Deploy</H3>
      <Code code={`fly launch --no-deploy --copy-config\nfly redis create                     # Upstash Redis; prints the URL\nfly secrets set DATABASE_URL=... REDIS_URL=... BETTER_AUTH_SECRET=... INTERNAL_SECRET=... S3_ENDPOINT=...\nfly deploy\nfly scale count 1`} />
      <p>Use any Postgres reachable from Fly (Fly&apos;s managed Postgres, Neon, Supabase) for <C>DATABASE_URL</C>.</p>
    </DocPage>
  );
}
