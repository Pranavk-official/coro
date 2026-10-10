"use client";
import { Suspense, useState } from "react";
import { useSession } from "@/lib/better-auth/client";
import AppHeader from "@/components/layout/AppHeader";
import NewMeetingMenu from "@/components/lobby/NewMeetingMenu";
import MeetingInput from "@/components/lobby/MeetingInput";
import RoomList from "@/components/lobby/RoomList";
import Landing from "@/components/landing/Landing";

function Hero({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col items-center gap-3 px-4 pb-8 pt-28 text-center sm:pt-36">
      <h1 className="text-[34px] leading-[1.07] font-semibold tracking-[-0.02em] sm:text-[56px]">Video calls.</h1>
      <p className="max-w-md text-[21px] leading-[1.19] text-muted sm:text-[28px] sm:leading-[1.14]">
        Simple, private, instant.
      </p>
      {children}
    </section>
  );
}

function Lobby() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
      <Hero>
        <div className="mt-4 flex w-full max-w-xl flex-col items-stretch gap-3 text-left sm:flex-row sm:items-start">
          <NewMeetingMenu />
          <MeetingInput />
        </div>
      </Hero>
      <section className="flex flex-col gap-3 px-4 pb-12 sm:px-6">
        <h2 className="text-[21px] font-semibold">Your rooms</h2>
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
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <Suspense>{!ready ? null : session?.user ? <Lobby /> : <Landing />}</Suspense>
    </div>
  );
}
