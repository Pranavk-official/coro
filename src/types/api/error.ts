export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "route_not_found"
  | "wrong_password"
  | "password_required"
  | "guests_not_allowed"
  | "locked"
  | "room_full"
  | "in_other_tab"
  | "ended"
  | "expired"
  | "validation_failed"
  | "invalid_json"
  | "unique_violation"
  | "foreign_key_violation"
  | "database_error"
  | "rate_limited"
  | "unavailable"
  | "try_again"
  | "internal_error"
  | "bad_request"
  | "bad_key_prefix"
  | "http_error";

export type ErrorEnvelope = {
  success: false;
  message: string;
  error: {
    code: ErrorCode;
    details?: unknown;
    retryAfter?: number;
  };
};
