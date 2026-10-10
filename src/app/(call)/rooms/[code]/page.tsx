"use client";
import { Suspense, use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRoom } from "@/hooks/use-rooms";
import RoomGate from "@/components/call/RoomGate";
import ShareDialog from "@/components/lobby/ShareDialog";
import PreJoin, { type JoinArgs } from "@/components/call/PreJoin";
import Call from "@/components/call/Call";
import LeftScreen from "@/components/call/LeftScreen";

function EntryResolved({ code, joinToken, asGuest }: { code: string; joinToken: string | null; asGuest: boolean }) {
  const router = useRouter();
  const room = useRoom(code);
  const params = useSearchParams();
  const [shareOpen, setShareOpen] = useState(params.get("share") === "1");
  const [initial, setInitial] = useState<JoinArgs | null>(null);
  const [left, setLeft] = useState(false);

  if (left) {
    return (
      <LeftScreen
        onRejoin={() => {
          setLeft(false);
          setInitial(null);
        }}
        onHome={() => router.push("/")}
      />
    );
  }

  return (
    <>
      {!initial ? (
        <PreJoin
          roomName={room.data?.name ?? code}
          code={code}
          isGuest={asGuest}
          askToJoin={asGuest}
          onJoin={(args) => setInitial(args)}
          onSignIn={() => router.push(`/sign-in?next=${encodeURIComponent(`/rooms/${code}`)}`)}
        />
      ) : (
        <Call
          code={code}
          joinToken={joinToken}
          initialStream={initial.stream}
          initialState={initial.state}
          initialScreen={initial.screen ?? null}
          onLeft={() => setLeft(true)}
        />
      )}
      {room.data && initial ? (
        <ShareDialog room={room.data} open={shareOpen} onClose={() => setShareOpen(false)} />
      ) : null}
    </>
  );
}

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  // params are request-time data: cacheComponents needs them read under a Suspense boundary
  return (
    <Suspense>
      <Room params={params} />
    </Suspense>
  );
}

function Room({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return (
    <RoomGate code={code}>
      {({ joinToken, asGuest }) => (
        <Suspense>
          <EntryResolved code={code} joinToken={joinToken} asGuest={asGuest} />
        </Suspense>
      )}
    </RoomGate>
  );
}
