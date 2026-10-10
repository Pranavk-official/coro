import { hc } from "hono/client";
import type { AppType } from "@/server/app";
import type { ErrorCode, ErrorEnvelope } from "@/types/api/error";

export const api = hc<AppType>("/");

export class ApiError extends Error {
  status: number;
  code: ErrorCode | "network_error" | "unknown";
  details?: unknown;
  retryAfter?: number;
  constructor(
    status: number,
    code: ErrorCode | "network_error" | "unknown",
    message: string,
    details?: unknown,
    retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

function isEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v["success"] !== false || typeof v["message"] !== "string") return false;
  const e = v["error"] as Record<string, unknown> | undefined;
  return typeof e?.["code"] === "string";
}

/** Seconds from `Retry-After` (ours) or `X-Retry-After` (better-auth); undefined when absent/unparsable. */
function retryAfterHeader(res: Response): number | undefined {
  const n = Number(res.headers.get("retry-after") ?? res.headers.get("x-retry-after") ?? NaN);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export async function apiJson<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (isEnvelope(body)) {
    throw new ApiError(
      res.status,
      body.error.code,
      body.message,
      body.error.details,
      body.error.retryAfter ?? retryAfterHeader(res),
    );
  }
  if (res.status === 429) {
    throw new ApiError(429, "rate_limited", "Too many requests", undefined, retryAfterHeader(res));
  }
  throw new ApiError(res.status, "unknown", `Request failed with status ${res.status}`);
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof TypeError) return new ApiError(0, "network_error", "Network error");
  return new ApiError(0, "unknown", err instanceof Error ? err.message : "Unknown error");
}
