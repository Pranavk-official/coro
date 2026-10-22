"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertDialog,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerDialog,
  DrawerHeader,
  DrawerHeading,
  Spinner,
  useOverlayState,
} from "@heroui/react";
import { AlignJustify, LogIn, LogOut } from "lucide-react";
import { signOut, useSession } from "@/lib/better-auth/client";
import SignInModal from "@/components/auth/SignInModal";
import ThemeSwitcher from "@/components/layout/ThemeSwitcher";
import BrandMark from "@/components/layout/BrandMark";
import { notify } from "@/lib/toast";
import { initials } from "@/lib/utils/initials";
import {
  glassBackdrop,
  glassContainer,
  glassDialog,
} from "@/components/ui/glass-overlay";

// Landing sections (signed-out only).
const LINKS = [
  ["How it works", "/#how"],
  ["Features", "/#features"],
  ["Pricing", "/#pricing"],
  ["FAQ", "/#faq"],
  ["Docs", "/docs"],
] as const;

const Logo = () => (
  <Link
    href="/"
    className="flex items-center gap-2 px-1 text-[21px] font-bold tracking-tight"
  >
    <BrandMark size={26} />
    coro
  </Link>
);

/**
 * Round icon CTA that slides its label out on hover/focus (always open on phones). The label carries the gap to the
 * icon itself (not the button's `gap`), so when it's collapsed the icon sits dead centre in a 36px circle.
 */
function PillLabel({ children }: { children: string }) {
  return (
    <span className="mr-1.5 max-w-24 overflow-hidden whitespace-nowrap transition-[max-width,margin] duration-300 md:mr-0 md:max-w-0 md:group-hover:mr-1.5 md:group-hover:max-w-24 md:group-focus-visible:mr-1.5 md:group-focus-visible:max-w-24">
      {children}
    </span>
  );
}

/** ui-layouts style nav: fixed, wide and bare at the top; shrinks into a blurred pill once you scroll. */
export default function AppHeader() {
  const { data: session, isPending, isRefetching } = useSession();
  const [leaving, setLeaving] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const menu = useOverlayState();
  const signedOut = !isPending && !session?.user;

  // "Scrolled" = the 24px marker at the top of the page has left the viewport. No scroll listener: nothing runs
  // per scroll event, the observer fires once each way.
  useEffect(() => {
    const el = top.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) =>
      setScrolled(!e?.isIntersecting),
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Landing: the section crossing the middle band of the viewport is the active nav item (hero = none).
  useEffect(() => {
    if (path !== "/") return;
    const ids = LINKS.map(([, href]) => href.split("#")[1]).filter(
      Boolean,
    ) as string[];
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        setSection(ids.find((id) => seen.get(id)) ?? null);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((x): x is HTMLElement => !!x);
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [path, signedOut]);

  /** Current page or section for a nav href: `/docs…` by path, `/#id` by the section in view. */
  const isActive = (href: string) =>
    href.includes("#")
      ? path === "/" && section === href.split("#")[1]
      : path.startsWith(href);

  async function leave() {
    setLeaving(true);
    // Floor of 600 ms: sign-out returns in ~50 ms and the page swap read as a glitch, not an action.
    const [res] = await Promise.all([
      signOut(),
      new Promise((r) => setTimeout(r, 600)),
    ]);
    setLeaving(false);
    if (res.error)
      return notify("sign-out", {
        title: "Couldn't sign out. Try again.",
        variant: "danger",
      });
    notify("sign-out", {
      title: "Signed out",
      description: "See you next time.",
      variant: "success",
    });
  }

  return (
    <>
      <div
        ref={top}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-6 w-px"
      />
      <header className="fixed inset-x-0 top-0 z-30 px-3 pt-[max(env(safe-area-inset-top),0.375rem)]">
        {/* Only width, colours and shadow animate. `transition-all` also eased the 20px backdrop blur in, recomputing
          the blur every frame of the shrink; now it switches on with the glass in one step. */}
        <nav
          className={`mx-auto flex items-center justify-between gap-2 rounded-full p-2 transition-[max-width,background-color,border-color,box-shadow] duration-300 ease-out ${
            scrolled ? "glass max-w-3xl" : "max-w-5xl border border-transparent"
          }`}
        >
          <div className="flex items-center gap-2">
            {signedOut && (
              <Button
                isIconOnly
                aria-label="Open menu"
                onPress={menu.open}
                className="size-9 rounded-xl! bg-foreground text-background md:hidden"
              >
                <AlignJustify size={20} aria-hidden />
              </Button>
            )}
            <Logo />
          </div>
          <div className="flex items-center gap-2">
            {signedOut && (
              <ul className="mr-2 hidden items-center gap-5 text-[15px] md:flex">
                {LINKS.map(([label, href]) => {
                  const on = isActive(href);
                  return (
                    <li key={href}>
                      <a
                        href={href}
                        aria-current={
                          on
                            ? href.includes("#")
                              ? "location"
                              : "page"
                            : undefined
                        }
                        className={`relative py-1 transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-accent after:transition-transform after:duration-300 ${
                          on
                            ? "text-foreground after:scale-x-100"
                            : "text-foreground/70 after:scale-x-0 hover:text-foreground"
                        }`}
                      >
                        {label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
            {/* full rail on wide screens; one-slot dock on phones (display:none keeps the other out of the a11y tree) */}
            <div className="hidden md:block">
              <ThemeSwitcher />
            </div>
            <div className="md:hidden">
              <ThemeSwitcher collapsed />
            </div>
            {session?.user &&
            !(session.user as { isAnonymous?: boolean }).isAnonymous ? (
              <Link
                href="/profile"
                aria-label="Profile"
                className="rounded-full"
              >
                <Avatar size="sm">
                  {session.user.image ? (
                    <AvatarImage src={session.user.image} />
                  ) : null}
                  <AvatarFallback>
                    {initials(session.user.name || session.user.email)}
                  </AvatarFallback>
                </Avatar>
              </Link>
            ) : null}
            {(!isPending || isRefetching) &&
              (session?.user ? (
                <AlertDialog>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="group h-9 min-w-9 gap-0 rounded-full px-[10px]"
                  >
                    <PillLabel>Sign out</PillLabel>
                    <LogOut size={16} aria-hidden />
                  </Button>
                  <AlertDialog.Backdrop
                    variant="blur"
                    className={glassBackdrop}
                    isDismissable={!leaving}
                    isKeyboardDismissDisabled={leaving}
                  >
                    <AlertDialog.Container
                      placement="center"
                      size="xs"
                      className={glassContainer}
                    >
                      <AlertDialog.Dialog className={glassDialog}>
                        <AlertDialog.Header>
                          <AlertDialog.Icon status="accent">
                            <LogOut className="size-5" />
                          </AlertDialog.Icon>
                          <AlertDialog.Heading>Sign out?</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                          <p className="text-muted">
                            You&apos;ll need to sign in again to start meetings.
                            Links you shared keep working.
                          </p>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                          <Button
                            slot="close"
                            variant="tertiary"
                            isDisabled={leaving}
                          >
                            Stay signed in
                          </Button>
                          {/* No slot="close": stays open with the spinner; unmounts when the session clears. */}
                          <Button
                            variant="primary"
                            isPending={leaving}
                            onPress={() => void leave()}
                          >
                            {leaving ? (
                              <>
                                <Spinner size="sm" color="current" />
                                Signing out…
                              </>
                            ) : (
                              "Sign out"
                            )}
                          </Button>
                        </AlertDialog.Footer>
                      </AlertDialog.Dialog>
                    </AlertDialog.Container>
                  </AlertDialog.Backdrop>
                </AlertDialog>
              ) : (
                <SignInModal>
                  <Button
                    variant="primary"
                    size="sm"
                    className="group h-9 min-w-9 gap-0 rounded-full px-[10px]"
                  >
                    <PillLabel>Sign in</PillLabel>
                    <LogIn size={16} aria-hidden />
                  </Button>
                </SignInModal>
              ))}
          </div>
        </nav>

        <Drawer state={menu}>
          <DrawerBackdrop>
            <DrawerContent placement="left">
              <DrawerDialog className="m-2 h-[calc(100%-1rem)] w-[min(20rem,80vw)] rounded-[22px] bg-[#0b0b0c] text-white">
                <DrawerCloseTrigger className="rounded-xl bg-accent text-accent-foreground" />
                <DrawerHeader>
                  <DrawerHeading className="flex items-center gap-2 text-[21px] font-bold tracking-tight">
                    <BrandMark size={26} />
                    coro
                  </DrawerHeading>
                </DrawerHeader>
                <DrawerBody>
                  <ul className="flex flex-col gap-1 text-[19px]">
                    {LINKS.map(([label, href]) => {
                      const on = isActive(href);
                      return (
                        <li key={href}>
                          <a
                            href={href}
                            onClick={menu.close}
                            aria-current={
                              on
                                ? href.includes("#")
                                  ? "location"
                                  : "page"
                                : undefined
                            }
                            className={`block rounded-xl px-3 py-2 ${on ? "bg-white/10 font-semibold text-white" : "text-white/85 hover:bg-white/10"}`}
                          >
                            {label}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </DrawerBody>
              </DrawerDialog>
            </DrawerContent>
          </DrawerBackdrop>
        </Drawer>
      </header>
    </>
  );
}
