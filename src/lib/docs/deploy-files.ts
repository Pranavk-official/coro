import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The docs show the repo's real deploy files, read at build time, so they can't drift from what ships.
 * Literal paths: a computed one makes Turbopack trace (and ship) the whole project.
 */
const read = (abs: string) => readFileSync(abs, "utf8").trimEnd();
export const DEPLOY = {
  caddyCompose: () => read(path.join(process.cwd(), "deploy", "caddy.compose.yml")),
  caddyfile: () => read(path.join(process.cwd(), "deploy", "Caddyfile")),
  nginx: () => read(path.join(process.cwd(), "deploy", "nginx.conf")),
  turn: () => read(path.join(process.cwd(), "deploy", "turn.compose.yml")),
};
