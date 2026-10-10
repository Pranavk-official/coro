import { expect, test } from "@playwright/test";
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnauthorizedError,
} from "../../src/server/shared/errors";

test("U14 @regression error subclasses carry status and default code", async () => {
  const cases = [
    [new BadRequestError(), 400, "bad_request"],
    [new UnauthorizedError(), 401, "unauthorized"],
    [new ForbiddenError(), 403, "forbidden"],
    [new NotFoundError(), 404, "not_found"],
    [new ConflictError(), 409, "conflict"],
    [new TooManyRequestsError(), 429, "rate_limited"],
    [new ServiceUnavailableError(), 503, "unavailable"],
  ] as const;
  for (const [err, status, code] of cases) {
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(status);
    expect(err.code).toBe(code);
    expect(err.name).toBe(err.constructor.name);
  }
  expect(new TooManyRequestsError().retryAfter).toBe(1);
  expect(new TooManyRequestsError("rate_limited", 30).retryAfter).toBe(30);
  const detailed = new BadRequestError("bad_key_prefix", "Bad key", { key: "x" });
  expect(detailed.details).toEqual({ key: "x" });
});
