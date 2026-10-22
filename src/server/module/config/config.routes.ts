import { Hono } from "hono";
import { rateLimit } from "@/server/middlewares/rate-limit";
import { publicConfig } from "@/server/module/config/config.service";

const config = new Hono().get("/", rateLimit("config", "ip"), (c) => c.json(publicConfig()));

export default config;
