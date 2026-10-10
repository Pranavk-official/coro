"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@heroui/react";
import { AuthError, authErrorCopy, useResetPassword } from "@/hooks/use-auth";
import AuthShell from "@/components/auth/AuthShell";
import PasswordInput from "@/components/ui/PasswordInput";

export default function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(!token || params.get("error") !== null);
  const reset = useResetPassword();

  async function submit() {
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    try {
      await reset.mutateAsync({ token, newPassword: password });
      router.push("/sign-in?reset=1");
    } catch (e) {
      if (e instanceof AuthError && e.code === "INVALID_TOKEN") setExpired(true);
      else setError(authErrorCopy(e));
    }
  }

  if (expired) {
    return (
      <AuthShell title="Choose a new password">
        <p role="alert" className="text-danger">
          This reset link has expired.
        </p>
        <Link href="/forgot-password" className="text-link">
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <PasswordInput
          label="New password"
          isRequired
          minLength={10}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          hint="At least 10 characters."
        />
        <PasswordInput
          label="Confirm password"
          isRequired
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          error={error}
        />
        <Button className="w-full" type="submit" variant="primary" isDisabled={reset.isPending}>
          Reset password
        </Button>
      </form>
    </AuthShell>
  );
}
