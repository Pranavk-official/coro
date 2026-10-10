"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { authErrorCopy, useRequestReset } from "@/hooks/use-auth";
import AuthShell from "@/components/auth/AuthShell";
import TextInput from "@/components/ui/TextInput";

export default function ForgotForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reset = useRequestReset();

  async function submit() {
    setError(null);
    try {
      await reset.mutateAsync(email);
      router.push(`/check-email?kind=reset&email=${encodeURIComponent(email)}`);
    } catch (e) {
      setError(authErrorCopy(e));
    }
  }

  return (
    <AuthShell title="Forgot your password?">
      <p className="text-sm text-muted">Enter your email and we&apos;ll send a reset link.</p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <TextInput label="Email" type="email" isRequired autoComplete="email" value={email} onChange={setEmail} error={error} />
        <Button className="w-full" type="submit" variant="primary" isDisabled={reset.isPending}>
          Send reset link
        </Button>
      </form>
      <Link href="/sign-in" className="text-sm text-link">
        Back to sign in
      </Link>
    </AuthShell>
  );
}
