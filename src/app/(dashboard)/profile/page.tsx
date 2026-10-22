"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage, Skeleton } from "@heroui/react";
import { useSession } from "@/lib/better-auth/client";
import { initials } from "@/lib/utils/initials";
import AppHeader from "@/components/layout/AppHeader";
import PageIntro, { PageBackdrop } from "@/components/layout/PageIntro";
import DriveCard from "@/components/profile/DriveCard";
import DeleteAccountCard from "@/components/profile/DeleteAccountCard";

export default function Page() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const user = session?.user;
  const guest = (user as { isAnonymous?: boolean } | undefined)?.isAnonymous ?? false;
  useEffect(() => {
    if (!isPending && (!user || guest)) router.replace("/sign-in?next=/profile");
  }, [isPending, user, guest, router]);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="relative isolate flex flex-1 flex-col overflow-hidden">
        <PageBackdrop />
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 pb-16 pt-28 sm:px-6 sm:pt-36">
          <PageIntro pill="Your account" title="Profile," accent="your way.">
            Connect your Drive, check your details, or leave for good.
          </PageIntro>
          {!user || guest ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-28 rounded-[26px]" />
              <Skeleton className="h-28 rounded-[26px]" />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <section className="flex items-center gap-4 rounded-[26px] bg-surface p-6 sm:p-7">
                <Avatar className="size-16 text-xl">
                  {user.image ? <AvatarImage src={user.image} /> : null}
                  <AvatarFallback>{initials(user.name || user.email)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h2 className="truncate text-[22px] font-semibold tracking-tight">{user.name || "No name yet"}</h2>
                  <p className="truncate text-muted">{user.email}</p>
                </div>
              </section>
              <DriveCard />
              <DeleteAccountCard email={user.email} />
              <p className="flex gap-6 px-2 pt-2 text-[14px] text-muted">
                <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
                <Link href="/terms" className="hover:text-foreground">Terms</Link>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
