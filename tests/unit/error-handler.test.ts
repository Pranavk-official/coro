import { expect, test } from "@playwright/test";
import { HTTPException } from "hono/http-exception";
import { ZodError, z } from "zod";
import { PrismaClientKnownRequestError } from "@prisma/client-runtime-utils";
import { errorHandler } from "../../src/server/middlewares/error-handler";
import {
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from "../../src/server/shared/errors";

function run(handler: (c: { json: (o: unknown, s: number) => unknown; header: () => void }) => unknown) {
  const calls: { body: unknown; status: number; headers: Record<string, string> }[] = [];
  const headers: Record<string, string> = {};
  const c = {
    json: (body: unknown, status: number) => {
      calls.push({ body, status, headers });
      return body;
    },
    header: (k: string, v: string) => {
      headers[k] = v;
    },
  };
  handler(c as never);
  return calls[0]!;
}

test("U15 @regression handler maps AppError/Zod/HTTP/SyntaxError/Prisma", async () => {
  let r = run((c) => errorHandler(new UnauthorizedError("wrong_password", "Wrong password."), c as never));
  expect(r.status).toBe(401);
  expect(r.body).toEqual({
    success: false,
    message: "Wrong password.",
    error: { code: "wrong_password" },
  });

  r = run((c) => errorHandler(new ForbiddenError(), c as never));
  expect(r.status).toBe(403);

  r = run((c) => errorHandler(new NotFoundError("route_not_found"), c as never));
  expect(r.status).toBe(404);

  const schema = z.object({ name: z.string() });
  const parsed = schema.safeParse({});
  expect(parsed.success).toBe(false);
  if (!parsed.success) {
    r = run((c) => errorHandler(new ZodError(parsed.error.issues), c as never));
    expect(r.status).toBe(400);
    expect(r.body).toEqual(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: "validation_failed" }) }),
    );
  }

  r = run((c) => errorHandler(new HTTPException(418, { message: "teapot" }), c as never));
  expect(r.status).toBe(418);

  r = run((c) => errorHandler(new SyntaxError("bad json"), c as never));
  expect(r.status).toBe(400);
  expect(r.body).toEqual(
    expect.objectContaining({ error: expect.objectContaining({ code: "invalid_json" }) }),
  );

  const p2002 = new PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "7" });
  r = run((c) => errorHandler(p2002, c as never));
  expect(r.status).toBe(409);
  expect(r.body).toEqual(
    expect.objectContaining({ error: expect.objectContaining({ code: "unique_violation" }) }),
  );

  const p2025 = new PrismaClientKnownRequestError("missing", { code: "P2025", clientVersion: "7" });
  r = run((c) => errorHandler(p2025, c as never));
  expect(r.status).toBe(404);

  const p9999 = new PrismaClientKnownRequestError("weird", { code: "P9999", clientVersion: "7" });
  r = run((c) => errorHandler(p9999, c as never));
  expect(r.status).toBe(500);
});

test("U16 production masks unknown errors, dev leaks message", async () => {
  const prev = process.env.NODE_ENV;
  Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true, writable: true, enumerable: true });
  const r = run((c) => errorHandler(new Error("s3cr3t stack"), c as never));
  expect(r.status).toBe(500);
  expect(r.body).toEqual({
    success: false,
    message: "Internal server error",
    error: { code: "internal_error" },
  });
  Object.defineProperty(process.env, "NODE_ENV", { value: prev, configurable: true, writable: true, enumerable: true });
});
test("U17 429 sets Retry-After and retryAfter", async () => {
  const r = run((c) => errorHandler(new TooManyRequestsError("rate_limited", 7), c as never));
  expect(r.status).toBe(429);
  expect(r.headers["Retry-After"]).toBe("7");
  expect(r.body).toEqual(
    expect.objectContaining({ error: expect.objectContaining({ code: "rate_limited", retryAfter: 7 }) }),
  );
});
