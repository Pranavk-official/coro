import type { Metadata } from "next";
import DocPage from "@/components/docs/DocPage";
import Code from "@/components/docs/CodeBlock";
import { C, H2, Note } from "@/components/docs/prose";
import { DEPLOY } from "@/lib/docs/deploy-files";

export const metadata: Metadata = { title: "VPS with Caddy · Docs", description: "Automatic HTTPS in front of the Coro compose stack." };

export default function Page() {
  return (
    <DocPage
      href="/docs/deploy/caddy"
    >
      <H2 id="files">The files</H2>
      <p>
        Caddy joins the compose network, routes your domain to <C>app:3000</C>, and gets and renews the Let&apos;s Encrypt
        certificate on its own. WebSockets need no extra configuration.
      </p>
      <Code lang="yaml" title="deploy/caddy.compose.yml" code={DEPLOY.caddyCompose()} />
      <Code lang="plaintext" title="deploy/Caddyfile" code={DEPLOY.caddyfile()} />

      <H2 id="run">Run it</H2>
      <p>With <C>DOMAIN</C> and the rest of the <a href="/docs/quick-start">production .env</a> filled in:</p>
      <Code code={`docker compose -f docker-compose.yml -f deploy/caddy.compose.yml up -d --build`} />
      <p>Check the certificate was issued:</p>
      <Code code={`docker compose -f docker-compose.yml -f deploy/caddy.compose.yml logs caddy | grep -i certificate`} />

      <H2 id="ports">Open the ports</H2>
      <p>
        Cloud firewalls (AWS security groups, GCP firewall rules, Hetzner and DigitalOcean cloud firewalls) must allow these
        inbound, as must ufw on the server:
      </p>
      <Code code={`sudo ufw allow 80/tcp\nsudo ufw allow 443/tcp\nsudo ufw allow 443/udp   # HTTP/3`} />
      <Note>Let&apos;s Encrypt checks your domain over port 80 before issuing the certificate, so open it even though the site redirects to HTTPS.</Note>
    </DocPage>
  );
}
