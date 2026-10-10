import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { PrismaClientKnownRequestError } from "@prisma/client-runtime-utils";
import { AppError, TooManyRequestsError } from "@/server/shared/errors";

const PRISMA: Record<string, [ContentfulStatusCode, string, string]> = {
  P2002: [409, "unique_violation", "Already exists"],
  P2003: [409, "foreign_key_violation", "Related record conflict"],
  P2025: [404, "not_found", "Record not found"],
};
const body = (message: string, code: string, extra: object = {}) => ({
  success: false as const,
  message,
  error: { code, ...extra },
});

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    if (err instanceof TooManyRequestsError) c.header("Retry-After", String(err.retryAfter));
    const extra =
      err instanceof TooManyRequestsError
        ? { retryAfter: err.retryAfter }
        : err.details
          ? { details: err.details }
          : {};
    return c.json(body(err.message, err.code, extra), err.status);
  }
  if (err instanceof ZodError)
    return c.json(body("Validation failed", "validation_failed", { details: err.issues }), 400);
  if (err instanceof HTTPException) {
    // hono/validator converts unparsable JSON into this exact HTTPException
    if (err.status === 400 && /malformed json/i.test(err.message)) {
      return c.json(body("Invalid JSON", "invalid_json"), 400);
    }
    return c.json(body(err.message, "http_error"), err.status);
  }
  if (err instanceof SyntaxError) return c.json(body("Invalid JSON", "invalid_json"), 400);
  if (err instanceof PrismaClientKnownRequestError) {
    const [status, code, message] = PRISMA[err.code] ?? [500, "database_error", "Database error"];
    if (status === 500) console.error("[db]", err.code, err.message);
    return c.json(body(message, code), status);
  }
  console.error("[unhandled]", err);
  return c.json(
    body(
      process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
      "internal_error",
    ),
    500,
  );
};
