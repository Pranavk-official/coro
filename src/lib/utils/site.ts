// Brand + public URL for metadata, OG image, robots and sitemap. Read at build time (Dockerfile passes BETTER_AUTH_URL).
export const SITE = {
  name: "Coro",
  tagline: "Many voices, one room.",
  description:
    "Free browser video calls. Share one link, guests join with no account, and you choose who gets in. Nothing to install.",
  url: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  author: { name: "Pranav K", url: "https://github.com/Pranavk-official" },
  repo: "https://github.com/Pranavk-official/coro",
};
