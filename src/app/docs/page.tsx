import type { Metadata } from "next";
import DocPage from "@/components/docs/DocPage";
import { C, CardLinks, H2 } from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Self-hosting docs",
  description: "Run Coro on your own server: what it needs, where it runs, and how to deploy it.",
};

const PARTS: [string, string][] = [
  ["App", "Next.js + Socket.IO on Node 24, built by the repo's Dockerfile"],
  ["Postgres", "Accounts, rooms and recording references"],
  ["Redis", "Rate limits and a short cache; nothing to back up"],
  ["S3 storage", "MinIO in the compose file, or any S3-compatible bucket"],
  ["SMTP", "Your mail provider, for sign-in links and verification"],
  ["coturn (optional)", "A TURN relay for callers on strict networks"],
];

export default function Page() {
  return (
    <DocPage
      href="/docs"
    >
      <H2 id="what-you-run">What you run</H2>
      <p>
        One app container serves the website, the API and real-time signaling. Call audio and video go straight between
        browsers, so the server carries signaling only. When two people can&apos;t reach each other directly, an optional
        TURN relay passes their encrypted media along.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {PARTS.map(([t, d]) => (
          <li key={t} className="rounded-2xl border border-hairline bg-surface p-4">
            <strong className="block">{t}</strong>
            <span className="text-[15px] text-muted">{d}</span>
          </li>
        ))}
      </ul>

      <H2 id="you-need">What you need</H2>
      <ul className="ml-5 list-disc space-y-1.5">
        <li>A Linux server with Docker 24+ and the Compose plugin. 1 vCPU and 2 GB RAM is plenty for a small team; building the image wants about 2 GB.</li>
        <li>A domain pointing at the server. Browsers only allow camera and microphone over HTTPS.</li>
        <li>Ports <C>80</C> and <C>443</C> open, plus <C>3478</C> and <C>49160–49200/udp</C> if you run TURN.</li>
        <li>Rooms hold up to 10 people: video is a full mesh between browsers, so each person&apos;s upload grows with the room.</li>
      </ul>

      <H2 id="where">Where it runs</H2>
      <p>
        Anywhere a Docker container runs continuously: a VPS, a home server, a self-hosted panel, or a container platform.
        It does <strong>not</strong> run on Vercel, Netlify, Cloudflare Pages or Workers, AWS Lambda or other serverless
        hosts. Coro is a long-running Node server that holds WebSocket connections and room state in memory, and it serves
        Next.js through a custom server.
      </p>

      <H2 id="next">Next steps</H2>
      <CardLinks
        items={[
          { href: "/docs/quick-start", title: "Quick start", body: "From a fresh server to your first call in about ten minutes." },
          { href: "/docs/deploy/caddy", title: "VPS with Caddy", body: "The default: automatic HTTPS in front of the compose stack." },
          { href: "/docs/deploy/panels", title: "Dokploy and Coolify", body: "Deploy the compose file from a self-hosted panel." },
          { href: "/docs/deploy/paas", title: "Railway, Render, Fly.io", body: "Just the app container, with managed Postgres and Redis." },
        ]}
      />
    </DocPage>
  );
}
