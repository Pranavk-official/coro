"use client";
import { useState } from "react";
import { Button, Card, CardContent } from "@heroui/react";
import { useVerifyPassword } from "@/hooks/use-rooms";
import { toApiError } from "@/lib/hono/client";
import { errorCopy } from "@/lib/utils/error-copy";
import PasswordInput from "@/components/ui/PasswordInput";
import { mmss, useCountdown } from "@/hooks/use-countdown";

export default function PasswordGate({
  code,
  onToken,
}: {
  code: string;
  onToken: (joinToken: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const verify = useVerifyPassword(code);
  const [wait, startWait] = useCountdown(); // spec 002 design §2: Join disabled, input kept

  async function submit() {
    setError(null);
    try {
      const { joinToken } = await verify.mutateAsync(password);
      onToken(joinToken);
    } catch (e) {
      const err = toApiError(e);
      if (err.status === 429) startWait(err.retryAfter);
      else setError(errorCopy(err.code));
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-md rounded-card border border-hairline p-0 shadow-none">
        <CardContent className="flex flex-col gap-3 p-6">
          <h1 className="text-xl font-semibold">Room password</h1>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <PasswordInput
              label="Room password"
              autoComplete="off"
              value={password}
              onChange={setPassword}
              error={wait > 0 ? `Too many attempts. Try again in ${mmss(wait)}.` : error}
              autoFocus
            />
            <Button type="submit" variant="primary" isDisabled={verify.isPending || wait > 0}>
              Join
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
