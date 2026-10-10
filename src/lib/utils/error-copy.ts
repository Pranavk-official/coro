import type { ErrorCode } from "@/types/api/error";

const COPY: Record<ErrorCode, string> = {
  unauthorized: "Sign in to continue.",
  forbidden: "You don't have permission to do that.",
  not_found: "Room not found. Check the code or ask for a new link.",
  route_not_found: "That page doesn't exist.",
  wrong_password: "Wrong password.",
  password_required: "This room needs a password.",
  guests_not_allowed: "This room doesn't allow guests — sign in to join.",
  locked: "This room is locked by the host.",
  room_full: "Room is full (10/10). Try again in a moment.",
  in_other_tab: "You're already in this call on another tab or device.",
  ended: "Meeting ended.",
  expired: "This room has expired.",
  validation_failed: "Check the highlighted fields and try again.",
  invalid_json: "The request couldn't be read. Try again.",
  unique_violation: "Already exists.",
  foreign_key_violation: "Related record conflict.",
  database_error: "Something went wrong. Try again.",
  rate_limited: "Too many requests. Wait a moment and retry.",
  unavailable: "Storage is unavailable right now. Try again later.",
  try_again: "Can't check the password right now. Try again in a moment.",
  internal_error: "Something went wrong. Try again.",
  bad_request: "That request was invalid. Try again.",
  bad_key_prefix: "That upload location isn't allowed.",
  http_error: "Something went wrong. Try again.",
};

export function errorCopy(code: string): string {
  const copy = (COPY as Record<string, string>)[code];
  return copy ?? "Something went wrong. Try again.";
}

export const ERROR_CODES = Object.keys(COPY) as ErrorCode[];

export function fieldErrors(details: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(details)) return out;
  for (const issue of details) {
    if (typeof issue !== "object" || issue === null) continue;
    const path = (issue as { path?: unknown }).path;
    const message = (issue as { message?: unknown }).message;
    if (Array.isArray(path) && path.length > 0 && typeof message === "string") {
      const key = path.map(String).join(".");
      if (!(key in out)) out[key] = message;
    }
  }
  return out;
}
