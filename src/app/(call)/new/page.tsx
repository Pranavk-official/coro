"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@heroui/react";
import type { PublicRoom } from "@/types/rooms/room";
import { useSession } from "@/lib/better-auth/client";
import { useCreateRoom } from "@/hooks/use-rooms";
import { expiryFrom } from "@/lib/utils/expiry";
import type { LengthValue } from "@/components/call/MeetingLength";
import PreJoin, { type JoinArgs } from "@/components/call/PreJoin";
import Call from "@/components/call/Call";
import LeftScreen from "@/components/call/LeftScreen";
import ShareDialog from "@/components/lobby/ShareDialog";

// Instant meeting: nothing exists until "Join now", so backing out leaves no room behind.
export default function NewMeetingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const create = useCreateRoom();
  const [length, setLength] = useState<LengthValue>({ key: "1h", custom: "" });
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [initial, setInitial] = useState<JoinArgs | null>(null);
  const [shareOpen, setShareOpen] = useState(true);
  const [left, setLeft] = useState(false);

  useEffect(() => {
    if (!isPending && !session?.user) router.replace("/sign-in?next=/new");
  }, [isPending, session, router]);

  if (!session?.user) {
    return (
      <main className="flex flex-1 items-center justify-center bg-black p-4">
        <Spinner aria-label="Loading" />
      </main>
    );
  }

  if (room && left) {
    return <LeftScreen onRejoin={() => router.push(`/rooms/${room.code}`)} onHome={() => router.push("/")} />;
  }

  if (room && initial) {
    return (
      <>
        <Call
          code={room.code}
          joinToken={null}
          initialStream={initial.stream}
          initialState={initial.state}
          initialScreen={initial.screen ?? null}
          onLeft={() => setLeft(true)}
        />
        <ShareDialog room={room} open={shareOpen} onClose={() => setShareOpen(false)} />
      </>
    );
  }

  return (
    <PreJoin
      roomName="Instant meeting"
      code=""
      isGuest={false}
      askToJoin={false}
      onSignIn={() => {}}
      length={{ value: length, onChange: setLength }}
      onJoin={async (args) => {
        const expiresAt = expiryFrom(new Date(), length.key, length.custom);
        const created = await create.mutateAsync({
          name: "Instant meeting",
          kind: "instant",
          ...(expiresAt ? { expiresAt } : {}),
        });
        window.history.replaceState(null, "", `/rooms/${created.code}`); // reload/share = the real room URL
        setRoom(created);
        setInitial(args);
      }}
    />
  );
}
