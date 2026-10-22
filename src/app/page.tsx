"use client";
import { Suspense, useEffect, useState } from "react";
import { signOut, useSession } from "@/lib/better-auth/client";
import AppHeader from "@/components/layout/AppHeader";
import NewMeetingMenu from "@/components/lobby/NewMeetingMenu";
import MeetingInput from "@/components/lobby/MeetingInput";
import RoomList from "@/components/lobby/RoomList";
import Landing from "@/components/landing/Landing";
import PageIntro, { PageBackdrop } from "@/components/layout/PageIntro";

function Lobby({ name }: { name: string }) {
  const first = name.trim().split(/\s+/)[0];
  return (
    <main className="relative isolate flex flex-1 flex-col overflow-hidden">
      <PageBackdrop />
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 px-4 pb-14 pt-28 sm:px-6 sm:pt-36">
        <PageIntro
          pill={first ? <>Signed in as {first}</> : "Welcome back"}
          title="Start a call,"
          accent="or join one."
        >
          One link for everyone. You decide who gets in.
        </PageIntro>
        <div className="flex w-full max-w-xl flex-col items-stretch gap-3 text-left sm:flex-row sm:items-start">
          <NewMeetingMenu />
          <MeetingInput />
        </div>
      </section>
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-16 sm:px-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[26px] font-bold tracking-[-0.03em] sm:text-[34px]">Your rooms</h2>
          <span className="hidden text-[15px] text-muted sm:block">Expired rooms clear themselves.</span>
        </div>
        <RoomList />
      </section>
    </main>
  );
}

export default function Home() {
  const { data: session, isPending } = useSession();
  // Blank only until the first session check resolves: the first fetch reports isPending AND isRefetching,
  // so gating on isRefetching flashed the landing for signed-in users. Later refetches (sign-out) keep the page.
  const [ready, setReady] = useState(false);
  if (!isPending && !ready) setReady(true);
  // Guest sessions exist only for one meeting: every way out of a call lands here, so end it here.
  const guest = (session?.user as { isAnonymous?: boolean } | undefined)?.isAnonymous ?? false;
  useEffect(() => {
    if (guest) void signOut();
  }, [guest]);
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <Suspense>{!ready ? null : session?.user && !guest ? <Lobby name={session.user.name ?? ""} /> : <Landing />}</Suspense>
    </div>
  );
}
