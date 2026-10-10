"use client";
import { useMutation } from "@tanstack/react-query";
import { authClient, signIn, signUp } from "@/lib/better-auth/client";

/** better-auth client error, thrown so mutations reject like the rest of the app. */
export class AuthError extends Error {
  code: string;
  status: number;
  /** Seconds, on 429 (our per-email limiter sends `Retry-After`, better-auth `X-Retry-After`). */
  retryAfter?: number;
  constructor(code: string, status: number, message: string, retryAfter?: number) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

type Result<T> = { data: T | null; error: { code?: string; message?: string; status: number } | null };
type FetchOptions = { onError: (ctx: { response: Response }) => void };

/** Runs a better-auth client call, throwing `AuthError` (with the 429 wait read from the response headers). */
async function unwrap<T>(run: (fetchOptions: FetchOptions) => Promise<Result<T>>): Promise<T | null> {
  let retryAfter: number | undefined;
  const onError: FetchOptions["onError"] = ({ response }) => {
    retryAfter = Number(response.headers.get("retry-after") ?? response.headers.get("x-retry-after")) || undefined;
  };
  const { data, error } = await run({ onError });
  if (error) throw new AuthError(error.code ?? "unknown", error.status, error.message ?? "", retryAfter);
  return data;
}

/** Copy for better-auth codes (design B9). Never says whether an account exists. */
export function authErrorCopy(err: unknown): string {
  if (!(err instanceof AuthError)) return "Something went wrong. Try again.";
  if (err.status === 429) {
    return err.retryAfter ? `Too many requests — try again in ${err.retryAfter} s.` : "Too many requests — wait a moment and try again.";
  }
  switch (err.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Invalid email or password.";
    case "EMAIL_NOT_VERIFIED":
      return "Verify your email first. We can send the link again.";
    case "PASSWORD_TOO_SHORT":
      return "At least 10 characters.";
    case "INVALID_EMAIL":
      return "Enter a valid email address.";
    case "INVALID_TOKEN":
    case "EXPIRED_TOKEN":
      return "This link has expired or was already used.";
    default:
      return "Something went wrong. Try again.";
  }
}

export const useMagicLink = () =>
  useMutation({
    mutationFn: (v: { email: string; next: string }) =>
      unwrap((fetchOptions) => signIn.magicLink({ email: v.email, callbackURL: v.next, fetchOptions })),
  });

export const useVerifyMagicLink = () =>
  useMutation({
    mutationFn: async (token: string) => {
      const data = await unwrap((fetchOptions) => authClient.magicLink.verify({ query: { token }, fetchOptions }));
      // A bad/used token is a 302 to `?error=…`; fetch follows it, so "success" without a session means failure.
      if (!data || typeof data !== "object" || !("session" in data)) throw new AuthError("INVALID_TOKEN", 400, "");
      return data;
    },
  });

export const useSignInPassword = () =>
  useMutation({
    mutationFn: (v: { email: string; password: string; next: string }) =>
      unwrap((fetchOptions) => signIn.email({ email: v.email, password: v.password, callbackURL: v.next, fetchOptions })),
  });

export const useSignUp = () =>
  useMutation({
    mutationFn: (v: { email: string; password: string; next: string }) =>
      unwrap((fetchOptions) =>
        signUp.email({
          email: v.email,
          password: v.password,
          name: v.email.split("@")[0] ?? v.email,
          callbackURL: `/verify-email?next=${encodeURIComponent(v.next)}`,
          fetchOptions,
        }),
      ),
  });

export const useResendVerification = () =>
  useMutation({
    mutationFn: (v: { email: string; next: string }) =>
      unwrap((fetchOptions) =>
        authClient.sendVerificationEmail({
          email: v.email,
          callbackURL: `/verify-email?next=${encodeURIComponent(v.next)}`,
          fetchOptions,
        }),
      ),
  });

export const useRequestReset = () =>
  useMutation({
    mutationFn: (email: string) =>
      unwrap((fetchOptions) => authClient.requestPasswordReset({ email, redirectTo: "/reset-password", fetchOptions })),
  });

export const useResetPassword = () =>
  useMutation({
    mutationFn: (v: { token: string; newPassword: string }) => unwrap((fetchOptions) => authClient.resetPassword({ ...v, fetchOptions })),
  });
