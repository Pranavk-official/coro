"use client";
import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import {
  ArrowRight,
  CalendarPlus,
  Check,
  CircleDot,
  Keyboard,
  Pin,
  SlidersHorizontal,
  Smartphone,
  Smile,
  Link2,
  Lock,
  Mic,
  MonitorUp,
  PhoneOff,
  Quote,
  ShieldCheck,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import SignInModal from "@/components/auth/SignInModal";
import MeetingInput from "@/components/lobby/MeetingInput";

/** Signed-out landing (look and rhythm after uploadthing.ui-layouts.com, on Coro's own tokens). */

function StartCta() {
  return (
    <SignInModal>
      <Button variant="primary" size="lg">
        Start a free meeting
      </Button>
    </SignInModal>
  );
}

const WORDS = ["Meet", "Teach", "Pitch", "Catch up"];

/** Hero verb that blurs in, one word at a time. Screen readers get the static h1 label instead. */
function RotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % WORDS.length), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <span key={i} className="blur-in inline-block">
      {WORDS[i]}
    </span>
  );
}

/** App tiles that peek out from behind the product shot, like files sticking out of a folder. */
const PEEK: [LucideIcon, string, number][] = [
  [Video, "bg-[#2997ff]", -14],
  [Mic, "bg-[#30b0a0]", 8],
  [MonitorUp, "bg-[#8b5cf6]", -6],
  [Users, "bg-[#f5a524]", 4],
  [CalendarPlus, "bg-[#ef4f6c]", -10],
  [Link2, "bg-[#3ccf6e]", 12],
  [ShieldCheck, "bg-[#5b6cff]", -4],
];

/**
 * `rise`: hero version. On hover-capable screens the tiles rest tucked behind the product shot and spring up,
 * fanned, when the pointer is over it (`group/shot`), like uploadthing. Touch screens keep them peeking.
 */
function PeekTiles({ className = "", rise = false }: { className?: string; rise?: boolean }) {
  return (
    <div aria-hidden className={`flex justify-center gap-2 sm:gap-4 ${className}`}>
      {PEEK.map(([Icon, bg, rot], i) => (
        <span
          key={i}
          style={
            {
              "--r": `${rot}deg`,
              "--y": `${i % 2 ? 10 : 0}px`,
              transitionDelay: `${Math.abs(i - 3) * 40}ms`,
            } as React.CSSProperties
          }
          className={`flex size-12 items-center justify-center rounded-2xl text-white shadow-lg [rotate:var(--r)] [translate:0_var(--y)] sm:size-20 sm:rounded-3xl ${bg} ${i > 4 ? "max-sm:hidden" : ""} ${
            rise
              ? "transition-[translate,rotate] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none [@media(hover:hover)]:[translate:0_calc(var(--y)+55%)] [@media(hover:hover)]:group-hover/shot:[rotate:calc(var(--r)*1.6)] [@media(hover:hover)]:group-hover/shot:[translate:0_calc(var(--y)-38%)]"
              : ""
          }`}
        >
          <Icon className="size-6 sm:size-9" strokeWidth={2.2} />
        </span>
      ))}
    </div>
  );
}

const PEOPLE = ["Ana", "Ben", "Chi", "Dev"];

/** Decorative product shot: a call window drawn with tokens only, no media. */
function ProductShot() {
  return (
    <div
      aria-hidden
      className="relative z-10 overflow-hidden rounded-[22px] border border-accent/50 bg-surface shadow-[0_30px_120px_-30px_color-mix(in_oklab,var(--accent)_60%,transparent)]"
    >
      <div className="flex items-center gap-1.5 border-b border-hairline px-4 py-3">
        {["bg-[#ff5f57]", "bg-[#febc2e]", "bg-[#28c840]"].map((c) => (
          <span key={c} className={`size-2.5 rounded-full ${c}`} />
        ))}
        <span className="mx-auto rounded-full bg-default px-3 py-0.5 text-xs text-muted">/rooms/abc-defg-hij</span>
      </div>
      <div className="bg-black p-2 sm:p-3">
        <div className="grid grid-cols-2 gap-2">
          {PEOPLE.map((name, i) => (
            <div
              key={name}
              className={`relative flex aspect-video items-center justify-center rounded-xl bg-white/10 ${i === 0 ? "ring-2 ring-accent" : ""}`}
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground sm:size-14 sm:text-lg">
                {name[0]}
              </span>
              <span className="absolute bottom-1.5 left-2 text-xs text-white/80">{name}</span>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-2 flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-white sm:mt-3">
          {[Mic, Video, MonitorUp].map((Icon, i) => (
            <span key={i} className="flex size-8 items-center justify-center rounded-full bg-white/15">
              <Icon size={16} />
            </span>
          ))}
          <span className="flex h-8 items-center rounded-full bg-danger px-3">
            <PhoneOff size={16} />
          </span>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden px-4 pb-20 pt-28 sm:px-6 sm:pt-36">
      <div aria-hidden className="landing-grid absolute inset-0 -z-10" />
      <div aria-hidden className="landing-dust absolute inset-x-0 top-0 -z-10 h-[520px]" />
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center">
        <a
          href="#how"
          className="inline-flex items-center gap-2 rounded-full border border-accent/70 bg-background/70 p-1 pr-3 text-[13px] backdrop-blur"
        >
          <span className="rounded-full bg-foreground px-2.5 py-0.5 text-background">why?</span>
          No downloads. No accounts.
          <ArrowRight size={14} aria-hidden />
        </a>
        <h1
          aria-label="Meet face to face, in two clicks."
          className="text-[40px] leading-[1.05] font-bold tracking-[-0.035em] sm:text-[76px]"
        >
          <span aria-hidden>
            <RotatingWord /> face to face,
            <br />
            <span className="text-accent">in two clicks.</span>
          </span>
        </h1>
        <p className="max-w-xl text-[18px] leading-[1.45] text-foreground/80 sm:text-[20px]">
          Start a call, share one link, and guests join from their browser. You decide who gets in. Nothing to install,
          nothing to pay.
        </p>
        <div id="join" className="flex w-full max-w-xl scroll-mt-28 flex-col items-stretch gap-3 text-left sm:flex-row sm:items-start">
          <div className="flex justify-center sm:mt-[26px] sm:block">
            <StartCta />
          </div>
          <MeetingInput />
        </div>
      </div>
      <div className="group/shot relative mx-auto mt-20 w-full max-w-4xl sm:mt-28">
        <PeekTiles rise className="absolute inset-x-0 -top-9 sm:-top-14" />
        <ProductShot />
      </div>
    </section>
  );
}

type Line = [text: string, tone?: "accent" | "muted" | "ok"];
const PANELS: { tab: string; lines: Line[] }[] = [
  {
    tab: "host",
    lines: [
      ["// you run the room", "muted"],
      ["Start a meeting"],
      ["Copy /rooms/abc-defg-hij", "accent"],
      ["Send it anywhere: chat, mail, calendar"],
      ["Someone knocks → Admit or Deny", "accent"],
      ["Lock the room once everyone's in"],
      ["Record → your device, or your Google Drive", "accent"],
      ["Mute, remove, or end for all", "muted"],
    ],
  },
  {
    tab: "guest",
    lines: [
      ["// they just show up", "muted"],
      ["Open the link"],
      ["Type a name"],
      ["Check camera and mic"],
      ["Ask to join", "accent"],
      ["You're in. No account.", "ok"],
      ["Someone records? You see REC.", "muted"],
    ],
  },
];
const TONE = { accent: "text-accent", muted: "text-muted italic", ok: "text-success" };

function HowItWorks() {
  return (
    <section id="how" className="relative isolate scroll-mt-20 overflow-hidden px-4 pb-24 pt-44 sm:px-6 sm:pt-56">
      <div aria-hidden className="landing-rays absolute inset-x-0 top-0 -z-10 h-[460px]" />
      <div aria-hidden className="landing-arc absolute left-1/2 top-[150px] -z-10 aspect-square w-[260%] -translate-x-1/2 rounded-full sm:top-[190px] sm:w-[160%]" />
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
        <span className="rounded-full bg-accent px-3 py-1 text-[13px] text-accent-foreground">Your link. Your rules.</span>
        <h2 className="text-[34px] leading-[1.05] font-bold tracking-[-0.03em] sm:text-[56px]">
          The right balance of
          <br />
          <span className="text-accent">privacy and simplicity.</span>
        </h2>
        <p className="max-w-xl text-[17px] text-foreground/80">
          You choose who gets in. Video goes straight between browsers, and recordings save to your device or your own
          Google Drive, never our servers.
        </p>
      </div>
      <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-[1.25fr_1fr]">
        {PANELS.map(({ tab, lines }) => (
          <div key={tab} className="flex flex-col">
            <span className="w-fit rounded-t-xl bg-surface px-4 pb-1 pt-2 text-[17px]">{tab}</span>
            <ol className="flex-1 rounded-b-2xl rounded-tr-2xl bg-surface p-5 font-mono text-[14px] leading-7 sm:text-[15px]">
              {lines.map(([text, tone], n) => (
                <li key={n} className="flex gap-4">
                  <span aria-hidden className="w-4 shrink-0 text-right text-muted/60 select-none">
                    {n + 1}
                  </span>
                  <span className={tone ? TONE[tone] : ""}>{text}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

function Statement() {
  return (
    <section className="px-4 py-16 sm:px-6">
      <figure className="mx-auto max-w-5xl rounded-[22px] bg-[linear-gradient(90deg,var(--accent),color-mix(in_oklab,var(--accent)_45%,#000)_45%,transparent_85%)] p-8 text-white sm:p-12">
        <Quote className="size-12 rotate-180 fill-white sm:size-16" strokeWidth={0} aria-hidden />
        <blockquote className="mt-4 max-w-2xl text-[24px] leading-[1.25] font-semibold sm:text-[34px]">
          A call should start like a phone call: one link, nothing to install, no account to make.
        </blockquote>
        <figcaption className="mt-6">
          <span className="block font-semibold">Why we built Coro</span>
          <span className="text-[15px] text-white/80">Free to use, open to self-host</span>
        </figcaption>
      </figure>
    </section>
  );
}

type Feature = { icon: LucideIcon; tone: string; tilt: number; title: string; body: string; span: string; chips?: string[] };
const FEATURES: Feature[] = [
  {
    icon: CalendarPlus,
    tone: "bg-[#ef4f6c]",
    tilt: -6,
    title: "Meet now, later, or on the calendar",
    body: "Start an instant call, make a link for later, or schedule one and add it to Google Calendar or any app with an .ics file. Every room gets a short code anyone can type.",
    span: "md:col-span-4",
    chips: ["abc-defg-hij", "Instant", "Link for later", "Scheduled"],
  },
  {
    icon: ShieldCheck,
    tone: "bg-[#5b6cff]",
    tilt: 5,
    title: "You decide who gets in",
    body: "Waiting room with admit or deny, optional password, room lock, mute or remove anyone, end it for all.",
    span: "md:col-span-2",
  },
  {
    icon: SlidersHorizontal,
    tone: "bg-[#30b0a0]",
    tilt: -4,
    title: "Check before you join",
    body: "Pick camera, mic and speaker, watch your mic level, and join with audio only, video only or just your screen. Your choices are remembered.",
    span: "md:col-span-2",
  },
  {
    icon: Smile,
    tone: "bg-[#f5a524]",
    tilt: 6,
    title: "A face even with the camera off",
    body: "Camera off? Your own mascot stands in on your tile, and turns to follow the cursor.",
    span: "md:col-span-2",
  },
  {
    icon: Smartphone,
    tone: "bg-[#3ccf6e]",
    tilt: -5,
    title: "Made for phones too",
    body: "Install it to your home screen. Controls sit in bottom sheets, and invites go out through your phone's share menu.",
    span: "md:col-span-2",
  },
  {
    icon: CircleDot,
    tone: "bg-danger",
    tilt: 4,
    title: "Record the whole meeting",
    body: "One tap records everyone's video and audio plus any screen share into one WebM or MP4 file. It saves to your device and, if you connect it, your Google Drive. Everyone sees a REC badge.",
    span: "md:col-span-3",
    chips: ["WebM / MP4", "720p option", "Google Drive"],
  },
  {
    icon: MonitorUp,
    tone: "bg-[#8b5cf6]",
    tilt: -6,
    title: "Present with sound",
    body: "Share a screen, window or tab, with the tab's audio. The presentation takes the stage, and the host can stop anyone's share.",
    span: "md:col-span-3",
  },
  {
    icon: Pin,
    tone: "bg-[#2997ff]",
    tilt: 5,
    title: "Follows the conversation",
    body: "The stage follows whoever is speaking, with a ring around their tile. Pin someone to keep them big.",
    span: "md:col-span-3",
  },
  {
    icon: Keyboard,
    tone: "bg-foreground",
    tilt: -4,
    title: "Keyboard first",
    body: "Mute, camera, share, people, copy link, lock and record each have one key. Press ? in a call to see them.",
    span: "md:col-span-3",
    chips: ["M", "V", "S", "P", "C", "L", "R", "?"],
  },
];

function Features() {
  return (
    <section id="features" className="scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center">
        <span className="rounded-full bg-accent px-3 py-1 text-[13px] text-accent-foreground">What&apos;s in the box</span>
        <h2 className="text-[34px] leading-[1.05] font-bold tracking-[-0.03em] sm:text-[56px]">
          Small app,
          <br />
          <span className="text-accent">real features.</span>
        </h2>
        <p className="max-w-xl text-[17px] text-foreground/80">Everything below works today, for free, in the browser.</p>
      </div>
      <ul className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-6">
        {FEATURES.map(({ icon: Icon, tone, tilt, title, body, span, chips }) => (
          <li
            key={title}
            className={`group flex flex-col gap-4 rounded-[22px] bg-surface p-6 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 motion-reduce:transition-none sm:p-7 ${span}`}
          >
            <span
              aria-hidden
              style={{ rotate: `${tilt}deg` }}
              className={`flex size-12 items-center justify-center rounded-2xl shadow-lg transition-[rotate] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:[rotate:0deg] ${tone} ${tone === "bg-foreground" ? "text-background" : "text-white"}`}
            >
              <Icon className="size-6" strokeWidth={2.2} />
            </span>
            <div className="flex flex-col gap-1.5">
              <h3 className="text-[20px] leading-tight font-semibold tracking-[-0.01em]">{title}</h3>
              <p className="text-[15px] leading-relaxed text-muted">{body}</p>
            </div>
            {chips ? (
              <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                {chips.map((c) => (
                  <span key={c} className="rounded-lg bg-default px-2 py-0.5 font-mono text-[13px]">
                    {c}
                  </span>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

const PLANS = [
  {
    name: "Guest",
    blurb: "For anyone you invite.",
    price: "$0",
    features: ["Join from a link or code", "No account needed", "Works on phones and laptops", "A mascot stands in when your camera is off"],
    cta: (
      <Button variant="secondary" className="w-full" onPress={() => document.getElementById("join")?.scrollIntoView({ behavior: "smooth" })}>
        Join with a code
      </Button>
    ),
  },
  {
    name: "Host",
    blurb: "For people who run meetings.",
    price: "$0",
    featured: true,
    features: [
      "Instant, later or scheduled, straight to your calendar",
      "Waiting room, password and room lock",
      "Screen share with tab audio, and pinning",
      "Record everyone to your device, plus Google Drive",
      "Up to 10 people per room",
    ],
    cta: <StartCta />,
  },
  {
    name: "Self-host",
    blurb: "Run it on your own servers.",
    price: "Yours",
    features: ["One docker compose up", "Postgres, Redis and S3 included", "Your data stays with you"],
    cta: <code className="block rounded-xl bg-default px-4 py-3 text-center font-mono text-[14px]">docker compose up -d</code>,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center">
        <h2 className="text-[34px] leading-[1.05] font-bold tracking-[-0.03em] sm:text-[56px]">
          Worry about the meeting,
          <br />
          <span className="text-accent">not the bill.</span>
        </h2>
        <p className="text-[17px] text-foreground/80">No plan, no card, no trial. It&apos;s free.</p>
      </div>
      <div className="mx-auto mt-10 grid max-w-5xl items-center gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={`flex flex-col gap-5 rounded-[26px] p-7 ${
              p.featured ? "bg-foreground text-background md:py-10" : "bg-surface"
            }`}
          >
            <div>
              <h3 className="text-[22px] font-semibold">{p.name}</h3>
              <p className={p.featured ? "text-background/70" : "text-muted"}>{p.blurb}</p>
            </div>
            <p className="text-[40px] leading-none font-bold tracking-tight">
              {p.price}
              {p.price.startsWith("$") && <span className="ml-1 text-[15px] font-medium opacity-70">/forever</span>}
            </p>
            {p.cta}
            <ul className="flex flex-col gap-2.5 text-[15px]">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

const FAQ = [
  ["Is it free?", "Yes. No plan, no card."],
  ["Do guests need an account?", "No. Rooms allow guests by default; the host can turn that off."],
  ["How many people fit?", "Up to 10 per room."],
  ["Can I share my screen?", "Yes, from any desktop browser that supports it."],
  ["Can I schedule ahead?", "Yes: pick a time, get a link, add it to your calendar."],
  [
    "Can I record a call?",
    "Yes, once you're signed in. One tap records everyone's video and audio, plus any screen share, and saves it to your device as WebM or MP4. Connect Google Drive on your profile and a copy lands there too. Everyone in the room sees a REC badge while you record.",
  ],
  ["What do I need?", "A recent browser, a camera and a mic. You choose devices before you join."],
  ["Can I delete my account?", "Yes, from your profile. We email you a link to confirm, then your account and rooms are gone."],
];

function Faq() {
  return (
    <section id="faq" className="mx-auto flex w-full max-w-3xl scroll-mt-20 flex-col gap-3 px-4 py-16 sm:px-6">
      <h2 className="mb-2 text-center text-[34px] font-bold tracking-[-0.03em] sm:text-[44px]">Questions</h2>
      {FAQ.map(([q, a]) => (
        <details key={q} className="group rounded-[18px] bg-surface px-5 py-4">
          <summary className="cursor-pointer list-none font-semibold marker:hidden">
            <span className="flex items-center justify-between gap-4">
              {q}
              <span aria-hidden className="text-muted transition-transform group-open:rotate-45">+</span>
            </span>
          </summary>
          <p className="pt-2 text-muted">{a}</p>
        </details>
      ))}
      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        <h2 className="text-[28px] font-semibold">Your next call starts here.</h2>
        <StartCta />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-4 pb-4 pt-12 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 border-t border-hairline px-2 py-6 text-[14px] text-muted">
        <span>© {new Date().getFullYear()} Coro. Many voices, one room.</span>
        <span className="flex flex-wrap gap-x-6 gap-y-2">
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
          <a href="/privacy" className="hover:text-foreground">Privacy</a>
          <a href="/terms" className="hover:text-foreground">Terms</a>
          <span className="flex items-center gap-1">
            <Lock size={13} aria-hidden /> Peer-to-peer
          </span>
        </span>
      </div>
      <div
        aria-hidden
        className="relative mx-auto flex h-[34vw] max-h-[420px] max-w-6xl items-start justify-center overflow-hidden rounded-[26px] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--accent)_22%,transparent),transparent_70%)]"
      >
        <span className="mt-[2vw] text-[30vw] leading-[0.85] font-bold tracking-[-0.06em] lg:text-[380px]">coro</span>
        <PeekTiles className="absolute inset-x-0 bottom-[8%]" />
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <HowItWorks />
      <Statement />
      <Features />
      <Pricing />
      <Faq />
      <Footer />
    </main>
  );
}
