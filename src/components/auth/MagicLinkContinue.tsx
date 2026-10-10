"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@heroui/react";
import { authErrorCopy, useVerifyMagicLink } from "@/hooks/use-auth";
import AuthShell from "@/components/auth/AuthShell";
import { safeNext } from "@/lib/utils/safe-next";

// Interstitial (spec 002 D14): the token is only spent when a human presses Continue.
export default function MagicLinkContinue() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const next = safeNext(params.get("next"));
  const verify = useVerifyMagicLink();
  const [error, setError] = useState<string | null>(token ? null : "no_token");

  async function go() {
    setError(null);
    try {
      await verify.mutateAsync(token);
      window.location.assign(next); // full load so every hook sees the new session cookie
    } catch (e) {
      setError(authErrorCopy(e));
    }
  }

  return (
    <AuthShell title="Almost there">
      {error ? (
        <>
          <p role="alert" className="text-danger">
            This link has expired or was already used.
          </p>
          <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="text-link">
            Request a new link
          </Link>
        </>
      ) : (
        <>
          <p>Click to finish signing in.</p>
          <Button className="w-full" variant="primary" autoFocus isDisabled={verify.isPending} onPress={() => void go()}>
            Continue
          </Button>
        </>
      )}
    </AuthShell>
  );
}
