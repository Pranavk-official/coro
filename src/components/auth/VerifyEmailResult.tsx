"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import { safeNext } from "@/lib/utils/safe-next";

// better-auth verifies on GET and redirects here: `?error=…` on failure, else the user is signed in.
export default function VerifyEmailResult() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const failed = params.get("error") !== null;

  useEffect(() => {
    if (failed) return;
    const t = setTimeout(() => window.location.assign(next), 3000);
    return () => clearTimeout(t);
  }, [failed, next]);

  if (failed) {
    return (
      <AuthShell title="This link has expired">
        <p>Sign in with your email and password and we&apos;ll send a fresh verification link.</p>
        <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="text-link">
          Resend verification
        </Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Email verified — you're signed in.">
      <p role="status">Taking you on in 3 seconds…</p>
      <Link href={next} className="text-link">
        Continue now
      </Link>
    </AuthShell>
  );
}
