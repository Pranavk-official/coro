import type { Metadata } from "next";
import DocPage from "@/components/docs/DocPage";
import Code from "@/components/docs/CodeBlock";
import { C, H2, Note, Shot, Step, Steps } from "@/components/docs/prose";
import { ENV_PROD } from "@/lib/docs/snippets";
import { SITE } from "@/lib/utils/site";

export const metadata: Metadata = { title: "Quick start · Docs", description: "Deploy Coro with Docker Compose and Caddy." };

export default function Page() {
  return (
    <DocPage
      href="/docs/quick-start"
    >
      <H2 id="steps">Steps</H2>
      <Steps>
        <Step title="Get the code">
          <Code code={`git clone ${SITE.repo}.git coro\ncd coro\ncp .env.example .env`} />
        </Step>
        <Step title="Generate secrets">
          <p>Run each line and paste the output into <C>.env</C>:</p>
          <Code code={`openssl rand -base64 32   # BETTER_AUTH_SECRET\nopenssl rand -hex 32      # INTERNAL_SECRET\nopenssl rand -hex 24      # POSTGRES_PASSWORD\nopenssl rand -hex 24      # MINIO_ROOT_PASSWORD (also S3_SECRET_KEY)`} />
        </Step>
        <Step title="Fill in .env">
          <p>Hostnames are the compose service names. Replace <C>meet.example.com</C> with your domain.</p>
          <Code lang="dotenv" title=".env" code={ENV_PROD} />
        </Step>
        <Step title="Start the stack with HTTPS">
          <Code code={`docker compose -f docker-compose.yml -f deploy/caddy.compose.yml up -d --build`} />
          <p>The first build takes a few minutes. Follow the app log until it says it&apos;s ready:</p>
          <Code code={`docker compose logs -f app\n# > ready on http://localhost:3000`} />
        </Step>
        <Step title="Open your domain">
          <p>Create an account (the verification mail goes through your SMTP), start a meeting, and open the link on a second device.</p>
        </Step>
      </Steps>

      <H2 id="firewall">Firewall</H2>
      <p>Open the same ports on the server&apos;s own firewall as in your cloud provider&apos;s:</p>
      <Code code={`sudo ufw allow 22/tcp\nsudo ufw allow 80/tcp\nsudo ufw allow 443\nsudo ufw enable`} />
      <Note>
        Want callers on strict networks to connect too? Add the <a href="/docs/turn">TURN relay</a> next; it needs a few more ports.
      </Note>

      <H2 id="result">What you get</H2>
      <Shot name="lobby" alt="Coro home page after signing in" caption="Signed in: start a call, join one by code, and manage your rooms." />
      <Shot name="prejoin" alt="Pre-join screen with camera preview and device pickers" caption="Every call starts with a device check. If the camera is blocked here, the site isn't on HTTPS." />
      <Shot name="call" alt="A three-person call, one with the camera off showing a mascot" caption="A three-person call. A tile shows the person's mascot when their camera is off." />
    </DocPage>
  );
}
