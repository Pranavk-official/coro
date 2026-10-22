/** Docs pages in one place: section tabs, sidebar, order (prev/next), "On this page", search and sitemap. */
export type Toc = [id: string, label: string][];
export type DocLink = { href: string; title: string; description: string; toc: Toc };

export const DOCS_NAV: { group: string; items: DocLink[] }[] = [
  {
    group: "Getting started",
    items: [
      {
        href: "/docs",
        title: "Introduction",
        description: "Coro is a self-hosted video calling app. These guides take you from an empty server to working calls on your own domain.",
        toc: [["what-you-run", "What you run"], ["you-need", "What you need"], ["where", "Where it runs"], ["next", "Next steps"]],
      },
      {
        href: "/docs/quick-start",
        title: "Quick start",
        description: "A fresh Ubuntu or Debian server with Docker installed, a DNS A record for your domain pointing at it, and about ten minutes.",
        toc: [["steps", "Steps"], ["firewall", "Firewall"], ["result", "What you get"]],
      },
    ],
  },
  {
    group: "Deploy",
    items: [
      {
        href: "/docs/deploy/caddy",
        title: "VPS with Caddy",
        description: "The default setup. Works on any Linux VM with Docker: AWS EC2, Google Compute Engine, DigitalOcean, Hetzner, Linode, Oracle Cloud's free tier, or a box in your office.",
        toc: [["files", "The files"], ["run", "Run it"], ["ports", "Open the ports"]],
      },
      {
        href: "/docs/deploy/nginx",
        title: "VPS with nginx",
        description: "Already running nginx on the server? Publish the app on localhost only and proxy to it.",
        toc: [["steps", "Steps"], ["config", "The site config"]],
      },
      {
        href: "/docs/deploy/panels",
        title: "Dokploy and Coolify",
        description: "The repo's docker-compose.yml is made for panels: the app has no host port, and the panel's proxy (Traefik) routes your domain to it.",
        toc: [["dokploy", "Dokploy"], ["coolify", "Coolify"], ["turn", "TURN on a panel"]],
      },
      {
        href: "/docs/deploy/paas",
        title: "Railway, Render, Fly.io",
        description: "Deploy only the app container from the repo's Dockerfile, and use the platform's managed Postgres and Redis plus any S3 bucket.",
        toc: [["common", "What every platform needs"], ["railway", "Railway"], ["render", "Render"], ["fly", "Fly.io"]],
      },
    ],
  },
  {
    group: "Configure",
    items: [
      {
        href: "/docs/configuration",
        title: "Environment variables",
        description: "All settings are environment variables. The repo's .env.example documents each one in a line; never commit a real .env.",
        toc: [["core", "Core"], ["data", "Data"], ["network", "Network"], ["sign-in-and-mail", "Sign-in and mail"], ["limits", "Limits"], ["overrides", "Overriding limits"]],
      },
      {
        href: "/docs/turn",
        title: "TURN relay",
        description: "Most calls connect directly. Callers on some corporate, school and mobile networks can't, and without a relay they join but see no video. TURN passes their encrypted media along without being able to read it.",
        toc: [["setup", "Set it up"], ["file", "The compose file"], ["test", "Check it works"]],
      },
      {
        href: "/docs/sign-in",
        title: "Sign-in providers",
        description: "Email sign-in works as soon as SMTP is set. Google and GitHub buttons appear once their keys are set. Guests never need an account.",
        toc: [["email", "Email"], ["google", "Google and Drive"], ["github", "GitHub"]],
      },
    ],
  },
  {
    group: "Operate",
    items: [
      {
        href: "/docs/operations",
        title: "Updates and backups",
        description: "Updating is pull and restart. Postgres is the only state worth backing up: Redis is a cache, and recordings live on people's devices and Drives.",
        toc: [["update", "Update"], ["backup", "Back up"], ["restore", "Restore"], ["logs", "Logs and status"]],
      },
      {
        href: "/docs/troubleshooting",
        title: "Troubleshooting",
        description: "Start with the app log; most problems name themselves there.",
        toc: [["first", "First look"], ["common", "Common problems"], ["help", "Getting help"]],
      },
    ],
  },
];

export const DOCS_PAGES: (DocLink & { group: string })[] = DOCS_NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));
