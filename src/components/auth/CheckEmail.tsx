"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@heroui/react";
import { AuthError, authErrorCopy, useMagicLink, useRequestReset, useResendVerification } from "@/hooks/use-auth";
import AuthShell from "@/components/auth/AuthShell";
import { safeNext } from "@/lib/utils/safe-next";

const KINDS = {
  magic: { what: "sign-in link", expires: "10 minutes" },
  verify: { what: "verification link", expires: "1 hour" },
  reset: { what: "password reset link", expires: "30 minutes" },
} as const;

const COOLDOWN = 30;

export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return email;
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}

export default function CheckEmail() {
  const params = useSearchParams();
  const kindParam = params.get("kind");
  const kind = kindParam === "verify" || kindParam === "reset" ? kindParam : "magic";
  const email = params.get("email") ?? "";
  const next = safeNext(params.get("next"));
  const [wait, setWait] = useState(COOLDOWN);
  const [error, setError] = useState<string | null>(null);
  const magic = useMagicLink();
  const verify = useResendVerification();
  const reset = useRequestReset();

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function resend() {
    setError(null);
    try {
      if (kind === "magic") await magic.mutateAsync({ email, next });
      else if (kind === "verify") await verify.mutateAsync({ email, next });
      else await reset.mutateAsync(email);
      setWait(COOLDOWN);
    } catch (e) {
      setError(authErrorCopy(e));
      setWait(e instanceof AuthError && e.retryAfter ? e.retryAfter : COOLDOWN);
    }
  }

  const { what, expires } = KINDS[kind];
  return (
    <AuthShell title="Check your email">
      <p>
        We sent a {what} to <strong>{maskEmail(email)}</strong>. It expires in {expires}.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button className="w-full" variant="secondary" isDisabled={!email || wait > 0} onPress={() => void resend()}>
        {wait > 0 ? `Resend link (${wait}s)` : "Resend link"}
      </Button>
      <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="text-sm text-link">
        Wrong address? Use a different email
      </Link>
    </AuthShell>
  );
}
