import type { Metadata } from "next";
import type { ReactNode } from "react";
import DocPage from "@/components/docs/DocPage";
import Code from "@/components/docs/CodeBlock";
import { C, H2, Note } from "@/components/docs/prose";

export const metadata: Metadata = { title: "Environment variables · Docs", description: "Every Coro setting, what it does, and whether you need it." };

type Need = "required" | "recommended" | "optional" | "never";
const ROWS: [group: string, rows: [name: string, need: Need, what: ReactNode][]][] = [
  [
    "Core",
    [
      ["BETTER_AUTH_URL", "required", "Public URL, no trailing slash. Builds OAuth callbacks, email links, OG tags and the sitemap. Also a Docker build argument."],
      ["BETTER_AUTH_SECRET", "required", "Signs sessions and room join tokens. Changing it signs everyone out."],
      ["INTERNAL_SECRET", "required", "Shared between the signaling server and the HTTP API inside the container."],
      ["PORT", "optional", <>Listen port, default <C>3000</C>. Container platforms set it for you.</>],
    ],
  ],
  [
    "Data",
    [
      ["DATABASE_URL", "required", "Postgres 16+ (18 in the compose file). Migrations run when the app starts."],
      ["S3_ENDPOINT · S3_REGION · S3_ACCESS_KEY · S3_SECRET_KEY · S3_BUCKET", "required", "Any S3-compatible store: the bundled MinIO, AWS S3, Cloudflare R2, Backblaze B2. The bucket is created on boot if the key may; otherwise create it first."],
      ["S3_PUBLIC_ENDPOINT", "required", "Browser-reachable S3 URL for presigned uploads. Recordings don't use it: they go to the device and Google Drive."],
      ["POSTGRES_PASSWORD · MINIO_ROOT_USER · MINIO_ROOT_PASSWORD", "required", "Read by docker-compose.yml to create the database and MinIO. Skip them with managed services."],
      ["REDIS_URL", "recommended", "Rate limits and a short read cache. Unset = both off."],
      ["REDIS_REQUIRED", "recommended", <>Set to <C>1</C> so the app refuses to start without Redis rather than running with limits off.</>],
    ],
  ],
  [
    "Network",
    [
      ["TRUST_PROXY", "recommended", <>Set to <C>1</C> behind any reverse proxy or platform router, or every visitor shares one rate-limit bucket. Leave unset when clients reach the app directly.</>],
      ["DOMAIN", "optional", <>Hostname Caddy serves and gets a certificate for (<C>deploy/caddy.compose.yml</C>).</>],
      ["TURN_HOST · TURN_SECRET", "optional", "TURN relay for callers behind strict NATs. Unset = STUN only."],
      ["TURN_EXTERNAL_IP", "optional", <>coturn&apos;s public address (<C>deploy/turn.compose.yml</C>): <C>public/private</C> behind cloud NAT.</>],
    ],
  ],
  [
    "Sign-in and mail",
    [
      ["SMTP_URL · MAIL_FROM", "recommended", "Outgoing mail. Unset = mails are logged, not sent, so email sign-in can't work."],
      ["GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET", "optional", "Google sign-in and saving recordings to Google Drive. The button shows only when both are set."],
      ["GITHUB_CLIENT_ID · GITHUB_CLIENT_SECRET", "optional", "GitHub sign-in. The button shows only when both are set."],
    ],
  ],
  [
    "Limits",
    [
      ["RATE_LIMIT_<NAME>", "optional", <>Override one limit as <C>max/windowSec</C>. See the example below.</>],
      ["RATE_LIMIT_MAIL_DAILY", "optional", <>Cap on outgoing mail per day, default <C>500/86400</C>.</>],
      ["AUTH_TEST_LOGIN · RATE_LIMIT_DISABLED", "never", "Test-only switches. The server refuses to start in production with either set."],
    ],
  ],
];
const NEED: Record<Need, string> = {
  required: "bg-accent text-accent-foreground",
  recommended: "bg-success/15 text-success",
  optional: "bg-default text-muted",
  never: "bg-danger/15 text-danger",
};

export default function Page() {
  return (
    <DocPage
      href="/docs/configuration"
    >
      {ROWS.map(([group, rows]) => (
        <section key={group} className="flex flex-col gap-3">
          <h2 id={group.toLowerCase().replace(/\W+/g, "-")} className="mt-4 scroll-mt-36 text-[24px] font-bold tracking-[-0.02em]">
            {group}
          </h2>
          <dl className="flex flex-col divide-y divide-hairline rounded-2xl border border-hairline bg-surface">
            {rows.map(([name, need, what]) => (
              <div key={name} className="flex flex-col gap-1.5 p-4 sm:grid sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-x-6">
                <dt className="flex flex-wrap items-start gap-2">
                  <span className="font-mono text-[13px] break-all">{name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[12px] whitespace-nowrap ${NEED[need]}`}>{need}</span>
                </dt>
                <dd className="text-[15px] leading-relaxed text-muted">{what}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <H2 id="overrides">Overriding limits</H2>
      <p>
        The variable name is the limit&apos;s name uppercased, with <C>:</C> and <C>-</C> turned into <C>_</C>. A malformed
        value is ignored with a warning at boot.
      </p>
      <Code lang="dotenv" title=".env" code={`RATE_LIMIT_ROOMS_VERIFY=3/600     # room password tries: 3 per 10 min\nRATE_LIMIT_ROOMS_CREATE=50/3600   # rooms a user may create per hour\nRATE_LIMIT_MAIL_DAILY=2000/86400  # all outgoing mail per day`} />
      <Note>After changing <C>.env</C>, recreate the app container so it reads the new values:</Note>
      <Code code={`docker compose up -d app`} />
    </DocPage>
  );
}
