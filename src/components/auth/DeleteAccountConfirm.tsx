"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, buttonVariants, Spinner } from "@heroui/react";
import { authErrorCopy, useConfirmAccountDelete } from "@/hooks/use-auth";
import { useSession } from "@/lib/better-auth/client";
import AuthShell from "@/components/auth/AuthShell";

// Interstitial like the magic link (spec 002 D14): mail scanners GET links, so only this button spends the token.
export default function DeleteAccountConfirm() {
  const token = useSearchParams().get("token") ?? "";
  const { data: session, isPending, refetch } = useSession();
  const confirm = useConfirmAccountDelete();
  const [done, setDone] = useState(false);
  const here = `/delete-account?token=${encodeURIComponent(token)}`;

  async function go() {
    await confirm.mutateAsync(token);
    setDone(true);
    await refetch(); // the cookie is gone server-side; drop the cached session everywhere
  }

  if (done) {
    return (
      <AuthShell title="Account deleted">
        <p>Your account and meetings are gone. Thanks for trying Coro.</p>
        <Link href="/" className={buttonVariants({ variant: "primary", className: "w-full" })}>
          Back to home
        </Link>
      </AuthShell>
    );
  }
  if (!token) {
    return (
      <AuthShell title="Delete account">
        <p role="alert" className="text-danger">This link is incomplete.</p>
        <Link href="/profile" className="text-link">Request a new link from your profile</Link>
      </AuthShell>
    );
  }
  if (isPending) {
    return (
      <AuthShell title="Delete account">
        <Spinner />
      </AuthShell>
    );
  }
  if (!session?.user) {
    return (
      <AuthShell title="Delete account">
        <p>Sign in with the account you want to delete, then you&apos;ll come back here.</p>
        <Link href={`/sign-in?next=${encodeURIComponent(here)}`} className="text-link">
          Sign in
        </Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Delete account?">
      <p>
        This permanently deletes <strong>{session.user.email}</strong>, every meeting you host, and your sign-in methods.
        It can&apos;t be undone.
      </p>
      {confirm.isError ? (
        <p role="alert" className="text-danger">
          {authErrorCopy(confirm.error)}
        </p>
      ) : null}
      <Button variant="danger" className="w-full" isPending={confirm.isPending} onPress={() => void go().catch(() => undefined)}>
        Delete my account
      </Button>
      <Link href="/" className="text-center text-link">
        Keep my account
      </Link>
    </AuthShell>
  );
}
