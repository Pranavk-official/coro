import type { Metadata } from "next";
import type { ReactNode } from "react";
import DocPage from "@/components/docs/DocPage";
import Code from "@/components/docs/CodeBlock";
import { C, H2 } from "@/components/docs/prose";
import { SITE } from "@/lib/utils/site";

export const metadata: Metadata = { title: "Troubleshooting · Docs", description: "Fixes for the common Coro self-hosting problems." };

const ISSUES: [q: string, a: ReactNode][] = [
  ["Camera and microphone are blocked on the pre-join screen", <>The page isn&apos;t on HTTPS. Browsers only allow media on <C>https://</C> or <C>localhost</C>.</>],
  ["People join but see a blank tile or no video", <>Their networks block direct connections. Set up the <a href="/docs/turn">TURN relay</a> and open its UDP ports.</>],
  ["Calls are slow to connect, or signaling falls back to polling", <>The proxy isn&apos;t passing WebSockets. Keep the <C>Upgrade</C> / <C>Connection</C> headers (nginx) and don&apos;t buffer <C>/socket.io</C>.</>],
  ["Google says redirect_uri_mismatch", <><C>BETTER_AUTH_URL</C> and the redirect URI must match exactly: scheme, host, no trailing slash, path <C>/api/auth/callback/google</C>.</>],
  ["Google: “Access blocked: app has not completed verification”", "The Google app is in Testing and this account isn't a test user. Add it, or publish the app."],
  ["Saving to Drive fails: “Google Drive API isn't enabled”", "Enable the Google Drive API in the same Cloud project as your client ID; it can take a few minutes to apply."],
  ["Everyone hits rate limits at once", <>Requests all look like they come from the proxy. Set <C>TRUST_PROXY=1</C>.</>],
  ["The app won't start: REDIS_REQUIRED=1 but Redis is unreachable", <>Check <C>REDIS_URL</C> (in compose: <C>redis://redis:6379</C>) and that the redis service is healthy.</>],
  ["The app won't start: S3 or bucket errors", "Check the S3_* values. With a bucket-scoped key, create the bucket first; the app only creates it when allowed to."],
  ["Sign-in links never arrive", <>Look for <C>[mail]</C> lines in the app log, then check SPF, DKIM and DMARC on the <C>MAIL_FROM</C> domain.</>],
];

export default function Page() {
  return (
    <DocPage
      href="/docs/troubleshooting"
    >
      <H2 id="first">First look</H2>
      <Code code={`docker compose ps\ndocker compose logs --tail=200 app\ncurl -sI https://meet.example.com | head -1   # expect HTTP/2 200`} />

      <H2 id="common">Common problems</H2>
      <dl className="flex flex-col divide-y divide-hairline rounded-2xl border border-hairline bg-surface">
        {ISSUES.map(([q, a]) => (
          <div key={q} className="flex flex-col gap-1 p-4">
            <dt className="font-semibold">{q}</dt>
            <dd className="text-[15px] text-muted">{a}</dd>
          </div>
        ))}
      </dl>

      <H2 id="help">Getting help</H2>
      <p>
        Open an issue on{" "}
        <a href={`${SITE.repo}/issues`} target="_blank" rel="noopener noreferrer">GitHub</a> with the app log (remove secrets
        first). Coro is{" "}
        <a href={`${SITE.repo}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">MIT-licensed</a>.
      </p>
    </DocPage>
  );
}
