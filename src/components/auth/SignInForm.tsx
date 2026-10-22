"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button } from "@heroui/react";
import {
  AuthError,
  authErrorCopy,
  useMagicLink,
  useResendVerification,
  useSignInPassword,
  useSignUp,
} from "@/hooks/use-auth";
import AuthShell from "@/components/auth/AuthShell";
import SocialButtons from "@/components/auth/SocialButtons";
import TextInput from "@/components/ui/TextInput";
import PasswordInput from "@/components/ui/PasswordInput";
import PasswordMeter from "@/components/auth/PasswordMeter";
import { safeNext } from "@/lib/utils/safe-next";
import { useCountdown } from "@/hooks/use-countdown";

type Mode = "magic" | "password" | "signup";

type Shell = (p: { title: string; children: ReactNode }) => ReactNode;

/** `shell` frames the form: full page (`AuthShell`, /sign-in) or a modal (`SignInModal`). */
export default function SignInForm({ shell: Frame = AuthShell }: { shell?: Shell }) {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<Mode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const magic = useMagicLink();
  const signInPw = useSignInPassword();
  const signUpPw = useSignUp();
  const resend = useResendVerification();
  const pending = magic.isPending || signInPw.isPending || signUpPw.isPending;
  const [wait, startWait] = useCountdown(); // 429: button disabled with a countdown, input kept (spec 002 E14)

  const checkEmail = (kind: string) =>
    router.push(`/check-email?kind=${kind}&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);

  async function submit() {
    setError(null);
    setUnverified(false);
    try {
      if (mode === "magic") {
        await magic.mutateAsync({ email, next });
        checkEmail("magic");
      } else if (mode === "password") {
        await signInPw.mutateAsync({ email, password, next });
        router.push(next);
      } else {
        await signUpPw.mutateAsync({ email, password, next });
        checkEmail("verify");
      }
    } catch (e) {
      if (e instanceof AuthError && e.code === "EMAIL_NOT_VERIFIED") setUnverified(true);
      if (e instanceof AuthError && e.status === 429) startWait(e.retryAfter);
      setError(authErrorCopy(e));
    }
  }

  return (
    <Frame title={mode === "signup" ? "Create an account" : "Sign in"}>
      <p className="-mt-2 text-sm text-muted">Sign in to start or join a call</p>
      {params.get("reset") === "1" ? (
        <Alert status="success">
          <Alert.Content>
            <Alert.Title>Password updated. Other devices were signed out.</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      <SocialButtons callbackURL={next} />
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-current opacity-30" />
        or
        <span className="h-px flex-1 bg-current opacity-30" />
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <TextInput
          label="Email"
          type="email"
          isRequired
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={setEmail}
        />
        {mode !== "magic" ? (
          <PasswordInput
            label="Password"
            isRequired
            minLength={mode === "signup" ? 10 : undefined}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={setPassword}
            hint={mode === "signup" ? <PasswordMeter value={password} /> : undefined}
          />
        ) : null}
        {wait > 0 ? (
          <p role="alert" className="text-sm text-danger">
            Too many requests — try again in {wait} s.
          </p>
        ) : error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        {unverified ? (
          <Button
            variant="secondary"
            isDisabled={resend.isPending || resend.isSuccess}
            onPress={() => resend.mutate({ email, next }, { onSuccess: () => checkEmail("verify") })}
          >
            Resend link
          </Button>
        ) : null}
        <Button className="w-full" type="submit" variant="primary" isDisabled={pending || wait > 0}>
          {mode === "magic" ? "Email me a sign-in link" : mode === "password" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <div className="flex flex-col gap-2 text-sm">
        {mode === "magic" ? (
          <button type="button" className="self-start text-link" onClick={() => setMode("password")}>
            Use a password instead
          </button>
        ) : (
          <button type="button" className="self-start text-link" onClick={() => setMode("magic")}>
            Email me a link instead
          </button>
        )}
        {mode === "password" ? (
          <Link href="/forgot-password" className="text-link">
            Forgot password?
          </Link>
        ) : null}
        {mode === "signup" ? (
          <button type="button" className="self-start text-link" onClick={() => setMode("password")}>
            Have an account? Sign in
          </button>
        ) : (
          <button type="button" className="self-start text-link" onClick={() => setMode("signup")}>
            New here? Create an account
          </button>
        )}
      </div>
      <p className="text-xs text-muted">
        By continuing you agree to the{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
    </Frame>
  );
}
