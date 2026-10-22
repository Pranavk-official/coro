"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Button, buttonVariants, Card, CardContent, Spinner } from "@heroui/react";
import { useSession } from "@/lib/better-auth/client";
import { authClient } from "@/lib/better-auth/client";
import { useRoom } from "@/hooks/use-rooms";
import { toApiError } from "@/lib/hono/client";
import { errorCopy } from "@/lib/utils/error-copy";
import { setPrefs } from "@/lib/utils/prefs";
import { useCountdown } from "@/hooks/use-countdown";
import TextInput from "@/components/ui/TextInput";
import SocialButtons from "@/components/auth/SocialButtons";
import RoomStatus from "@/components/call/RoomStatus";
import PasswordGate from "@/components/call/PasswordGate";

export type GateReady = {
  joinToken: string | null;
  asGuest: boolean;
};

function SignedOutGate({ roomName, allowGuests }: { roomName: string; allowGuests: boolean }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [wait, startWait] = useCountdown(); // 429 on guest sign-in: inline, no toast (spec 002 design §2)

  async function continueAsGuest() {
    setError(null);
    if (!name.trim()) {
      setError("Enter a name to continue as guest.");
      return;
    }
    setPending(true);
    // Save first: signing in re-renders straight into pre-join, which reads the name from prefs.
    setPrefs({ guestName: name.trim() });
    try {
      let retryAfter: number | undefined;
      const res = await authClient.signIn.anonymous({
        fetchOptions: { onError: (ctx) => void (retryAfter = Number(ctx.response.headers.get("x-retry-after")) || undefined) },
      });
      if (res.error) {
        if (res.error.status === 429) startWait(retryAfter);
        else setError(errorCopy("internal_error"));
        return;
      }
      await authClient.updateUser({ name: name.trim() });
    } catch (e) {
      setError(errorCopy(toApiError(e).code));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-md rounded-card border border-hairline p-0 shadow-none">
        <CardContent className="flex flex-col gap-3 p-6 text-center">
          <h1 className="text-xl font-semibold">Join {roomName}</h1>
          <SocialButtons
            callbackURL={typeof window === "undefined" ? "/" : window.location.pathname}
            divider={allowGuests ? <div className="text-sm text-muted">or</div> : null}
          />
          {allowGuests ? (
            <>
              <TextInput label="Your name" value={name} onChange={setName} placeholder="Dana" error={wait > 0 ? `Too many guests from your network. Try again in ${wait} s.` : error} className="w-full text-left" />
              <Button variant="primary" onPress={() => void continueAsGuest()} isDisabled={pending || wait > 0}>
                Continue as guest
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">Sign in required for this room.</p>
              <Link
                href={`/sign-in?next=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}`}
                className={buttonVariants({ variant: "primary" })}
              >
                Sign in
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export default function RoomGate({
  code,
  children,
}: {
  code: string;
  children: (ready: GateReady) => ReactNode;
}) {
  const { data: session, isPending: sessionPending } = useSession();
  const user = session?.user;
  // Room details need a session (rooms may be private), so signed-out visitors get the guest entry first.
  const room = useRoom(code, Boolean(user));
  const [joinToken, setJoinToken] = useState<string | null>(null);

  if (!sessionPending && !user) {
    return <SignedOutGate roomName={code} allowGuests />;
  }
  if (!user || room.isPending) {
    return (
      <main className="flex flex-1 items-center justify-center bg-background p-4 text-foreground">
        <Spinner aria-label="Loading room" />
      </main>
    );
  }

  if (room.isError) {
    const code = toApiError(room.error).code;
    if (code === "not_found") {
      return (
        <RoomStatus
          title="Room not found"
          body="Check the code or ask for a new link."
          actionLabel="Back to home"
          actionHref="/"
        />
      );
    }
    return (
      <RoomStatus
        title="Couldn't load this room"
        body={errorCopy(code)}
        actionLabel="Back to home"
        actionHref="/"
      />
    );
  }

  const info = room.data;
  if (info.status === "ended") {
    return <RoomStatus title="Meeting ended." actionLabel="Back to home" actionHref="/" redirectHomeIn={5} />;
  }
  if (info.status === "expired") {
    return (
      <RoomStatus
        title="This room has expired."
        actionLabel="Back to home"
        actionHref="/"
      />
    );
  }

  const isHost = user.id === info.hostId;
  if (info.hasPassword && !isHost && joinToken === null) {
    return <PasswordGate code={info.code} onToken={setJoinToken} />;
  }

  return <>{children({ joinToken, asGuest: (user as { isAnonymous?: boolean }).isAnonymous ?? false })}</>;
}
