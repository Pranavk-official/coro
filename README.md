<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/brand/logo-dark.svg">
  <img src="public/brand/logo.svg" alt="Coro" height="64">
</picture>

**Many voices, one room.**<br>
Browser video calls for small groups. Meet-style codes, guests without accounts, one `docker compose up`.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io)](https://socket.io)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://www.prisma.io)
[![Postgres](https://img.shields.io/badge/Postgres-18-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Playwright](https://img.shields.io/badge/tested%20with-Playwright-2EAD33?logo=playwright)](https://playwright.dev)

[Overview](#overview) · [Showcase](#showcase) · [Getting started](#getting-started) · [Tests](#tests) · [Deploy](#deploy) · [Project layout](#project-layout)

</div>

## Overview

Coro is a self-hosted video conferencing app built to feel as simple as Google Meet. You start a meeting, share an `abc-defg-hij` code or link, and admit people as they arrive. Everything runs in the browser over WebRTC; one Node process serves the UI, the HTTP API and the Socket.IO signaling.

- **Instant, later or scheduled meetings.** Start now, create a link for later (valid 30 days), or schedule one with an "Add to calendar" link.
- **One input for codes and links.** Paste a code with or without dashes, or any meeting URL.
- **Pre-join before every call.** Camera preview, mic level meter, device pickers, remembered preferences.
- **No sign-in wall for guests.** Guests enter a name and wait in a waiting room; the host admits or denies them.
- **Host controls.** Optional room password, guests on/off, lock, admit all, end for everyone.
- **In-call essentials.** Screen share, active-speaker highlight, pin, live device switching, keyboard shortcuts (`?` lists them).
- **Sign-in options.** Google, GitHub, magic link, or email + password with verification and password reset.
- **Rate limited.** Redis-backed limits on every route and socket event.

> [!NOTE]
> Calls use a full WebRTC mesh, so rooms are capped at **10 people**. A LiveKit SFU for larger rooms is planned.

> [!TIP]
> **Why "Coro"?** It means *chorus* in Italian, Spanish and Portuguese (from Latin *chorus*): many voices as one. The mark is an open ring, the group and a "C", around a dot, the voice speaking.

### Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router) + custom `server.ts` on Node 24 via `tsx` |
| API | Hono at `/api/*` via `@hono/vercel`, zod validation |
| Realtime | Socket.IO (same origin) + WebRTC mesh, optional coturn |
| Data | Prisma 7 + Postgres 18, Redis (rate limits + read cache), MinIO / S3 |
| Auth | better-auth (OAuth, magic link, email/password, anonymous guests) |
| UI | HeroUI v3 + Tailwind CSS v4, TanStack Query |
| Tests | Playwright for unit, integration and e2e |

## Showcase

<img src="docs/screenshots/desktop-dark-1-landing.jpg" alt="Coro landing page on desktop, dark theme">

| Desktop | Tablet | Phone |
|---|---|---|
| <img src="docs/screenshots/desktop-dark-5-call.jpg" alt="Call on desktop"> | <img src="docs/screenshots/tablet-dark-5-call.jpg" alt="Call on tablet"> | <img src="docs/screenshots/mobile-dark-5-call.jpg" alt="Call on phone"> |
| <img src="docs/screenshots/desktop-light-4-prejoin.jpg" alt="Pre-join on desktop"> | <img src="docs/screenshots/tablet-light-4-prejoin.jpg" alt="Pre-join on tablet"> | <img src="docs/screenshots/mobile-light-4-prejoin.jpg" alt="Pre-join on phone"> |
| <img src="docs/screenshots/desktop-light-3-lobby.jpg" alt="Lobby on desktop"> | <img src="docs/screenshots/tablet-light-3-lobby.jpg" alt="Lobby on tablet"> | <img src="docs/screenshots/mobile-light-3-lobby.jpg" alt="Lobby on phone"> |

<details>
<summary>All screens (landing, sign-in, lobby, pre-join, call) in light and dark</summary>

| | Light | Dark |
|---|---|---|
| Landing · full page | <img src="docs/screenshots/desktop-light-0-landing-full.jpg" width="420"> | <img src="docs/screenshots/desktop-dark-0-landing-full.jpg" width="420"> |
| Landing · phone | <img src="docs/screenshots/mobile-light-1-landing.jpg" width="240"> | <img src="docs/screenshots/mobile-dark-1-landing.jpg" width="240"> |
| Sign-in · phone | <img src="docs/screenshots/mobile-light-2-sign-in.jpg" width="240"> | <img src="docs/screenshots/mobile-dark-2-sign-in.jpg" width="240"> |
| Landing · tablet | <img src="docs/screenshots/tablet-light-1-landing.jpg" width="320"> | <img src="docs/screenshots/tablet-dark-1-landing.jpg" width="320"> |
| Sign-in · desktop | <img src="docs/screenshots/desktop-light-2-sign-in.jpg" width="420"> | <img src="docs/screenshots/desktop-dark-2-sign-in.jpg" width="420"> |
| Call · desktop | <img src="docs/screenshots/desktop-light-5-call.jpg" width="420"> | <img src="docs/screenshots/desktop-dark-5-call.jpg" width="420"> |

All 32 shots (3 devices × 2 themes × 5 screens, plus the full desktop landing page) are in [`docs/screenshots/`](docs/screenshots). Regenerate them with `bun run screenshots`.

</details>

## Getting started

### Prerequisites

- [Node.js 24](https://nodejs.org)
- [Bun](https://bun.sh) (package manager and script runner)
- [Docker](https://docs.docker.com/get-docker/) with Compose (Postgres, MinIO, Redis, Mailpit)

### Run locally

```bash
bun install
cp dev/.env.dev.example .env   # defaults work as-is
./dev/dev-start.sh -S          # Postgres + MinIO + Redis up, migrate, dev server
```

Open <http://localhost:3000>.

> [!TIP]
> Auth emails (magic links, verification, reset) go to Mailpit. Start it with
> `docker compose -f dev/docker-compose.dev.yml up -d mailpit` and read mail at <http://localhost:18025>.

### Sign-in providers

Google and GitHub buttons show only when their client ID is set. Register these callback URLs:

```
${BETTER_AUTH_URL}/api/auth/callback/google
${BETTER_AUTH_URL}/api/auth/callback/github
```

Locally, `BETTER_AUTH_URL` is `http://localhost:3000`. Magic link and email + password work without any OAuth setup.

### Environment

[`.env.example`](.env.example) (production compose) and [`dev/.env.dev.example`](dev/.env.dev.example) (local dev) list every variable with a one-line description. They are the contract: any new variable goes there.

> [!WARNING]
> `AUTH_TEST_LOGIN=1` and `RATE_LIMIT_DISABLED=1` are for Playwright only. The server refuses to boot with either set in production.

### Dev scripts

Scripts in [`dev/`](dev) use pacman-style flags. `-h` prints usage, unknown flags exit 1, and destructive operations ask `[y/N]`.

| Command | What it does |
|---|---|
| `dev/dev-start.sh -S` | Services up, migrate, dev server |
| `dev/dev-start.sh -Sd` | Services only, detached |
| `dev/dev-stop.sh -R` | Stop everything (`compose down`) |
| `dev/dev-stop.sh -Rn` | Stop and delete volumes |
| `dev/dev-db.sh -M <name>` | New migration + generate client |
| `dev/dev-db.sh -B` / `-U <file>` | Back up to `dev/backups/` / restore |
| `dev/dev-db.sh -Q` | Migration status |
| `dev/dev-db.sh -Qs` | Prisma Studio |
| `dev/dev-db.sh -Qo` | MinIO console URL + credentials |
| `dev/dev-db.sh -Qm` | Mailpit UI URL (dev inbox) |
| `dev/dev-db.sh -Qr` | Redis stats + blocked-request counters per limit |
| `dev/dev-db.sh -Qrf` | Reset rate-limit counters and strikes (keeps the cache) |

## Tests

Every level runs on Playwright. E2E uses Chromium's fake camera and mic.

```bash
bun run test               # all projects
bun run test:unit          # pure functions
bun run test:int           # API + socket against a running server
bun run test:e2e           # browser flows
bun run test:regression    # everything tagged @regression
bun run test:uat           # user stories tagged @uat
bun run screenshots        # README showcase → docs/screenshots/ (desktop, iPad, iPhone × light/dark)
bunx tsc --noEmit && bun run lint
```

## Deploy

```bash
cp .env.example .env   # set POSTGRES_PASSWORD, MINIO_ROOT_PASSWORD, BETTER_AUTH_SECRET, INTERNAL_SECRET, ...
docker compose up -d   # app on :3000 (migrations applied on boot), Postgres, MinIO, Redis
docker compose --profile turn up -d coturn   # optional TURN relay (needs TURN_SECRET)
```

> [!IMPORTANT]
> WebRTC needs HTTPS outside `localhost`. Put the app behind a TLS-terminating reverse proxy, set `BETTER_AUTH_URL` to the public URL, and set `TRUST_PROXY=1`. Set `TURN_HOST` and `TURN_SECRET` so callers behind strict NATs can connect.

## Rate limits

Redis holds fixed-window counters (`rl:*`), socket strikes (`strike:*`) and a short read cache (`cache:*`); all of it is disposable. Defaults sit about 5× above normal use.

| Limit | Applies to | Keyed by | Default |
|---|---|---|---|
| `api:global` / `api:user` | every `/api/*` except auth + internal | IP / user | 120 / 240 per min |
| `rooms:verify` | room password check | IP+room and user+room | 5 per 5 min (fails closed) |
| `rooms:create` · `rooms:get` · `ice` · `storage:presign` | those routes | user / IP | 20/h · 60/min · 30/10 min · 60/min |
| `auth:*` | sign-in, sign-up, magic link, reset | IP (better-auth) or email (hashed) | e.g. magic link 3 per email / 10 min |
| `auth:password` | password sign-in | IP+email | 10 per 10 min (fails closed) |
| `mail:daily` | every outgoing mail | global | 500 per day |
| `sock:*` | socket connect, join, signal, state, host actions | IP / user / socket | 30 · 20 · 600 · 60 · 60 per min; 3 strikes in 60 s disconnect |

- **Override** any limit with `RATE_LIMIT_<NAME>=max/windowSec`: the name uppercased, `:` and `-` turned into `_`. Example: `RATE_LIMIT_ROOMS_VERIFY=3/600`. A malformed value is ignored with a warning.
- **Blocked** requests get `429` with `Retry-After` and `{ error: { code: "rate_limited", retryAfter } }`; sockets get the same code in the ack or a `rate_limited` event.
- **Redis down**: every limit allows the request and logs `rate_limit_unavailable`, except room passwords and password sign-in, which answer `503 try_again`. Set `REDIS_REQUIRED=1` in production to refuse to boot without Redis.
- **Behind a proxy**, set `TRUST_PROXY=1`, or every client shares the proxy's IP. Leave it unset when clients reach the app directly, because then anyone could pick their own bucket with `X-Forwarded-For`.
- **Dev and Playwright** run with `RATE_LIMIT_DISABLED=1` (the cache stays on). The limiter's own tests run in-process: `tests/integration/rate-limit*.test.ts`.

## Email

Auth mail (magic link, email verification, password reset, "you already have an account") goes out over SMTP through `lib/nodemailer`. It is fire-and-forget: a failed send is logged and never changes the HTTP answer, so responses can't reveal which addresses have accounts.

- **Dev**: Mailpit catches everything. The UI is at <http://localhost:18025> (`dev/dev-db.sh -Qm`), SMTP is `localhost:11025`.
- **Prod**: set `SMTP_URL` to your provider's SMTP URL, for example `smtps://user:pass@smtp.example.com:465` (Resend, Postmark, SES and others all offer SMTP), and set `MAIL_FROM` to a sender on a domain you control. `RATE_LIMIT_MAIL_DAILY` caps the total number of mails sent per day.
- **Deliverability checklist** for the `MAIL_FROM` domain:
  - [ ] SPF: a TXT record that includes your provider (`v=spf1 include:<provider> ~all`)
  - [ ] DKIM: the provider's DKIM CNAME/TXT records, verified in its dashboard
  - [ ] DMARC: `_dmarc` TXT, start with `v=DMARC1; p=none; rua=mailto:you@yourdomain`, tighten to `quarantine` once reports are clean
  - [ ] Send a magic link to [mail-tester.com](https://www.mail-tester.com) and to a Gmail and an Outlook inbox to confirm it lands outside spam

## Project layout

```
server.ts          Custom server: Next + Socket.IO on one port
src/
  app/             Routes: (auth)/ (call)/ and the Hono catch-all at api/[[...route]]
  server/          Hono backend: app.ts, routes/, module/<feature>/, middlewares/, shared/
  components/      UI by feature: call/ lobby/ auth/ layout/ ui/
  hooks/           TanStack Query + client state (use-*.ts)
  lib/             One folder per integration: better-auth/ prisma/ socket.io/ redis/ s3/ webrtc/ ...
  types/           Types shared across layers
prisma/            Schema, migrations, seed
tests/             Playwright: unit/ integration/ e2e/ showcase/
dev/               Dev compose + scripts
docs/screenshots/  README showcase (generated by tests/showcase/)
public/brand/      Logo, wordmark and mark (SVG)
```

Metadata lives in `src/app/`: `opengraph-image.tsx` (generated OG/Twitter card), `icon.svg`, `apple-icon.tsx`, `manifest.ts`, `robots.ts` and `sitemap.ts`. They all read the brand and public URL from `src/lib/utils/site.ts`, which uses `BETTER_AUTH_URL` at build time.

Request flow: hook → typed `hc` client → Hono route (zod) → service (Prisma + libs). Every HTTP error uses one envelope: `{ success: false, message, error: { code } }`.

