import type { Metadata } from "next";
import DocPage from "@/components/docs/DocPage";
import Code from "@/components/docs/CodeBlock";
import { C, H2, Note } from "@/components/docs/prose";

export const metadata: Metadata = { title: "Updates and backups · Docs", description: "Keep a Coro server current and its data safe." };

export default function Page() {
  return (
    <DocPage
      href="/docs/operations"
    >
      <H2 id="update">Update</H2>
      <p>Database migrations run every time the app starts.</p>
      <Code code={`cd coro\ngit pull\ndocker compose -f docker-compose.yml -f deploy/caddy.compose.yml up -d --build`} />

      <H2 id="backup">Back up</H2>
      <Code code={`docker compose exec -T db pg_dump -U app -Fc app > coro-$(date +%F).dump`} />
      <p>Run it daily with cron, and copy the files off the server:</p>
      <Code lang="plaintext" title="crontab -e" code={`15 3 * * * cd /home/ubuntu/coro && docker compose exec -T db pg_dump -U app -Fc app > backups/coro-$(date +\\%F).dump`} />
      <Note>In a crontab, <C>%</C> must be escaped as <C>\%</C>, as above.</Note>

      <H2 id="restore">Restore</H2>
      <Code code={`docker compose exec -T db pg_restore -U app -d app --clean --if-exists < coro-2026-10-22.dump\ndocker compose restart app`} />

      <H2 id="logs">Logs and status</H2>
      <Code code={`docker compose ps                       # everything healthy?\ndocker compose logs -f --tail=200 app   # app, signaling, mail\ndocker compose logs coturn              # TURN, if you run it`} />
    </DocPage>
  );
}
