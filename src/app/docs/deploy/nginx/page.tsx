import type { Metadata } from "next";
import DocPage from "@/components/docs/DocPage";
import Code from "@/components/docs/CodeBlock";
import { C, H2, Note, Step, Steps } from "@/components/docs/prose";
import { DEPLOY } from "@/lib/docs/deploy-files";

export const metadata: Metadata = { title: "VPS with nginx · Docs", description: "Run Coro behind an existing nginx." };

export default function Page() {
  return (
    <DocPage
      href="/docs/deploy/nginx"
    >
      <H2 id="steps">Steps</H2>
      <Steps>
        <Step title="Publish the app on localhost">
          <p>Create this file next to <C>docker-compose.yml</C>; Compose picks it up on its own.</p>
          <Code lang="yaml" title="docker-compose.override.yml" code={`services:\n  app:\n    ports:\n      - "127.0.0.1:3000:3000"`} />
        </Step>
        <Step title="Add the site">
          <Code code={`sudo cp deploy/nginx.conf /etc/nginx/sites-available/coro\nsudo sed -i 's/meet.example.com/YOUR.DOMAIN/g' /etc/nginx/sites-available/coro\nsudo ln -s ../sites-available/coro /etc/nginx/sites-enabled/coro`} />
        </Step>
        <Step title="Get a certificate and reload">
          <Code code={`sudo certbot --nginx -d YOUR.DOMAIN\nsudo nginx -t && sudo systemctl reload nginx`} />
        </Step>
        <Step title="Start the stack">
          <Code code={`docker compose up -d --build`} />
        </Step>
      </Steps>

      <H2 id="config">The site config</H2>
      <Code lang="nginx" title="deploy/nginx.conf" code={DEPLOY.nginx()} />
      <Note tone="warn">
        Keep the two <C>Upgrade</C> / <C>Connection</C> lines. Without them Socket.IO falls back to long polling and calls
        are slow to connect. <C>http2 on;</C> needs nginx 1.25.1 or newer; on older versions use <C>listen 443 ssl http2;</C>.
      </Note>
    </DocPage>
  );
}
