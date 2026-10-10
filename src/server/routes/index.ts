import { Hono } from "hono";
import rooms from "@/server/module/rooms/rooms.routes";
import internal from "@/server/module/internal/internal.routes";
import ice from "@/server/module/ice/ice.routes";
import storage from "@/server/module/storage/storage.routes";

const routes = new Hono()
  .route("/rooms", rooms)
  .route("/internal", internal)
  .route("/ice-servers", ice)
  .route("/storage", storage);

export default routes;
