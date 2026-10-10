import type { ContentfulStatusCode } from "hono/utils/http-status";

export class AppError extends Error {
  status: ContentfulStatusCode;
  code: string;
  details?: unknown;
  constructor(status: ContentfulStatusCode, code: string, message = code, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export class BadRequestError extends AppError {
  constructor(code = "bad_request", message?: string, details?: unknown) {
    super(400, code, message, details);
  }
}
export class UnauthorizedError extends AppError {
  constructor(code = "unauthorized", message?: string) {
    super(401, code, message);
  }
}
export class ForbiddenError extends AppError {
  constructor(code = "forbidden", message?: string) {
    super(403, code, message);
  }
}
export class NotFoundError extends AppError {
  constructor(code = "not_found", message?: string) {
    super(404, code, message);
  }
}
export class ConflictError extends AppError {
  constructor(code = "conflict", message?: string) {
    super(409, code, message);
  }
}
export class TooManyRequestsError extends AppError {
  retryAfter: number;
  constructor(code = "rate_limited", retryAfter = 1, message?: string) {
    super(429, code, message);
    this.retryAfter = retryAfter;
  }
}
export class ServiceUnavailableError extends AppError {
  constructor(code = "unavailable", message?: string) {
    super(503, code, message);
  }
}
