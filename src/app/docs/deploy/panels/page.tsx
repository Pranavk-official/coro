import type { Metadata } from "next";
import DocPage from "@/components/docs/DocPage";
import Code from "@/components/docs/CodeBlock";
import { C, H2, Note, Step, Steps } from "@/components/docs/prose";

export const metadata: Metadata = { title: "Dokploy and Coolify · Docs", description: "Deploy Coro's compose file from a self-hosted panel." };

export default function Page() {
  return (
    <DocPage
      href="/docs/deploy/panels"
    >
      <H2 id="dokploy">Dokploy</H2>
      <Steps>
        <Step title="Create a Compose service">
          <p>Project → <strong>Create Service → Compose</strong>, source: your fork of the repo, compose path <C>./docker-compose.yml</C>.</p>
        </Step>
        <Step title="Add the environment">
          <p>Paste the <a href="/docs/quick-start">production .env</a> into the service&apos;s <strong>Environment</strong> tab. Leave out <C>DOMAIN</C>; the panel handles HTTPS.</p>
        </Step>
        <Step title="Add the domain">
          <p><strong>Domains → Add</strong>: your host, service <C>app</C>, container port <C>3000</C>, HTTPS on with Let&apos;s Encrypt.</p>
        </Step>
        <Step title="Deploy">
          <p>Watch the <C>app</C> logs for the ready line:</p>
          <Code code={`> ready on http://localhost:3000`} lang="plaintext" title="app logs" />
        </Step>
      </Steps>

      <H2 id="coolify">Coolify</H2>
      <Steps>
        <Step title="New resource">
          <p><strong>+ New → Public/Private Repository</strong>, build pack <strong>Docker Compose</strong>, compose file <C>/docker-compose.yml</C>.</p>
        </Step>
        <Step title="Environment and domain">
          <p>Paste the production .env under <strong>Environment Variables</strong>. On the <C>app</C> service, set the domain with the container port appended:</p>
          <Code lang="plaintext" title="Domains for app" code={`https://meet.example.com:3000`} />
        </Step>
        <Step title="Deploy" />
      </Steps>

      <H2 id="turn">TURN on a panel</H2>
      <Note>
        The panel owns ports 80 and 443, so skip <C>deploy/caddy.compose.yml</C>. TURN needs host networking, which panels
        usually don&apos;t manage: run it from the server&apos;s shell instead (see <a href="/docs/turn">TURN relay</a>).
      </Note>
      <Code code={`cd /path/to/coro\ndocker compose -f docker-compose.yml -f deploy/turn.compose.yml up -d coturn`} />
    </DocPage>
  );
}
