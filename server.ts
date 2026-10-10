import "dotenv/config";
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { registerSignaling, type TypedServer } from "@/lib/socket.io/server";
import { bootCheck } from "@/lib/rate-limit/boot";
import { REMOTE_ADDR_HEADER } from "@/lib/rate-limit/ip";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
if (!dev && process.env.AUTH_TEST_LOGIN === "1") {
  throw new Error("AUTH_TEST_LOGIN=1 auto-verifies accounts; refusing to start in production");
}
for (const warning of await bootCheck()) console.warn(`[boot] ${warning}`);
const app = next({ dev, port });
const handle = app.getRequestHandler();
await app.prepare();
const httpServer = createServer((req, res) => {
  // Rate limits key on this (spec 002 FR4); overwrite so clients can't choose their own bucket.
  req.headers[REMOTE_ADDR_HEADER] = req.socket.remoteAddress ?? "";
  return handle(req, res);
});
const io: TypedServer = new Server(httpServer);
registerSignaling(io, {
  base: `http://127.0.0.1:${port}`,
  internalSecret: process.env.INTERNAL_SECRET ?? "",
  tokenSecret: process.env.BETTER_AUTH_SECRET ?? "",
});
httpServer.listen(port, () => console.log(`> ready on http://localhost:${port}`));
