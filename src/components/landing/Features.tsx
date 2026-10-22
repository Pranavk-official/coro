import type { CSSProperties, ReactNode } from "react";
import { Check, Clock, HardDrive, Monitor, Plus, SlidersHorizontal, Smartphone, Smile, SunMoon } from "lucide-react";
import { FaGoogleDrive } from "react-icons/fa6";

/**
 * Landing features, after ui-layouts' feature3 bento: each card is an illustration on top with the title and line of
 * copy pinned bottom-left, on a soft accent wash. Everything is CSS (keyframes in globals.css, `feat-*`), still under
 * prefers-reduced-motion.
 */

function Card({ title, body, className = "", children }: { title: string; body: string; className?: string; children: ReactNode }) {
  return (
    <li
      className={`relative isolate flex min-h-[19rem] flex-col justify-end overflow-hidden rounded-[22px] border border-accent/15 bg-[linear-gradient(160deg,color-mix(in_oklab,var(--accent)_10%,var(--surface)),var(--surface)_70%)] p-6 sm:p-7 ${className}`}
    >
      <div aria-hidden className="feat-dots absolute inset-0 -z-10" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex h-[62%] items-center justify-center px-6">
        {children}
      </div>
      <h3 className="text-[20px] leading-tight font-semibold tracking-[-0.01em]">{title}</h3>
      <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-muted">{body}</p>
    </li>
  );
}

/** Voice level: the speaking ring's idea, as bars. */
const BARS = [0.45, 0.8, 0.6, 0.95, 0.5, 0.75, 1, 0.65, 0.85, 0.4, 0.7, 0.9, 0.55, 0.8, 0.45, 0.95, 0.6, 0.75, 0.5];
function Waveform() {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <div className="flex h-28 items-center gap-1.5 sm:gap-2">
        {BARS.map((h, i) => (
          <span
            key={i}
            style={{ height: `${h * 100}%`, animationDelay: `${(i % 7) * -0.17}s` } as CSSProperties}
            className="feat-wave w-2 rounded-full bg-accent sm:w-2.5"
          />
        ))}
      </div>
      <span className="flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-1 text-[12px] backdrop-blur">
        <span className="size-1.5 animate-pulse rounded-full bg-success" /> Dana is speaking
      </span>
    </div>
  );
}

function RecordingVisual() {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="flex items-center gap-2 rounded-full bg-danger px-4 py-2 font-mono text-[15px] font-semibold text-white shadow-lg">
        <span className="size-2.5 animate-pulse rounded-full bg-white" /> REC 04:12
      </span>
      <span className="h-6 w-px bg-[linear-gradient(var(--danger),transparent)]" />
      <div className="flex gap-2">
        <span className="feat-float flex items-center gap-1.5 rounded-xl bg-background/80 px-3 py-2 text-[13px] shadow-sm backdrop-blur">
          <HardDrive size={14} /> This device
        </span>
        <span style={{ animationDelay: "-1.5s" }} className="feat-float flex items-center gap-1.5 rounded-xl bg-background/80 px-3 py-2 text-[13px] shadow-sm backdrop-blur">
          <FaGoogleDrive size={12} className="text-[#30b0a0]" /> Google Drive
        </span>
      </div>
    </div>
  );
}

const KNOCKS: [name: string, state: "in" | "admit" | "wait"][] = [
  ["Amara Okafor", "in"],
  ["Tomás Reyes", "admit"],
  ["Guest · Priya", "wait"],
];
function WaitingRoomVisual() {
  return (
    <ul className="flex w-full max-w-xs flex-col gap-2">
      {KNOCKS.map(([name, state]) => (
        <li
          key={name}
          className={`flex items-center gap-3 rounded-2xl bg-background/80 px-3 py-2 text-[14px] shadow-sm backdrop-blur ${state === "wait" ? "opacity-55" : ""}`}
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-accent/15 text-[12px] font-semibold text-accent">
            {name.replace("Guest · ", "")[0]}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
          {state === "in" ? (
            <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[12px] text-success">
              <Check size={12} /> In
            </span>
          ) : state === "admit" ? (
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-[12px] text-accent-foreground">Admit</span>
          ) : (
            <span className="text-[12px] text-muted">Waiting</span>
          )}
        </li>
      ))}
    </ul>
  );
}

const PEOPLE = ["AO", "TR", "PK", "LM", "JS", "NW", "EB"];
function PeopleVisual() {
  // Two rows on a zig-zag, joined like a call mesh (each browser talks to each).
  const top = PEOPLE.slice(0, 4);
  const bottom = PEOPLE.slice(4);
  const dot = (t: string, i: number, faded = false) => (
    <span
      key={t}
      style={{ animationDelay: `${i * -0.6}s` }}
      className={`feat-float flex size-11 items-center justify-center rounded-full border-2 border-background text-[13px] font-semibold text-white shadow-md ${
        faded ? "bg-accent/55" : "bg-accent"
      }`}
    >
      {t}
    </span>
  );
  return (
    <div className="relative flex w-full max-w-xs flex-col gap-6">
      <svg className="absolute inset-0 -z-10 h-full w-full text-accent/35" preserveAspectRatio="none" viewBox="0 0 100 100">
        <path d="M12 22 L30 78 L37 22 L62 78 L63 22 L88 78 L88 22" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between">{top.map((t, i) => dot(t, i))}</div>
      <div className="flex justify-around px-6">{bottom.map((t, i) => dot(t, i + 4, true))}</div>
    </div>
  );
}

function ScheduleVisual() {
  const row = (label: string, offset: string, filled = false) => (
    <div className={`flex items-center gap-2 ${offset}`}>
      {filled ? (
        <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md">
          <Plus size={16} />
        </span>
      ) : null}
      <span className="rounded-xl border border-accent/40 bg-background/80 px-3 py-1.5 text-[14px] backdrop-blur">{label}</span>
      {filled ? null : (
        <span className="flex size-8 items-center justify-center rounded-full border border-accent/40 bg-background/80 text-accent">
          <Plus size={16} />
        </span>
      )}
    </div>
  );
  return (
    <div className="flex flex-col items-center gap-2.5">
      {row("Instant meeting", "translate-x-4")}
      {row("Link for later", "-translate-x-3", true)}
      {row("Scheduled + calendar", "translate-x-2")}
    </div>
  );
}

const WINDOWS = ["bg-[#ef4f6c]", "bg-[#f5a524]", "bg-[#3ccf6e]", "bg-[#2997ff]", "bg-[#8b5cf6]", "bg-[#30b0a0]"];
function ShareVisual() {
  const strip = (dir: "" | "feat-marquee-rev", blur: string) => (
    <div className={`flex w-max gap-4 ${dir || "feat-marquee"}`}>
      {[...WINDOWS, ...WINDOWS].map((bg, i) => (
        <span key={i} className={`flex h-16 w-20 shrink-0 flex-col overflow-hidden rounded-2xl shadow-lg ${bg} ${blur}`}>
          <span className="flex gap-1 bg-black/15 px-2 py-1.5">
            <span className="size-1.5 rounded-full bg-white/80" />
            <span className="size-1.5 rounded-full bg-white/60" />
            <span className="size-1.5 rounded-full bg-white/40" />
          </span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="flex w-full flex-col gap-4 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_15%,#000_85%,transparent)]">
      {strip("", "")}
      {strip("feat-marquee-rev", "opacity-80 blur-[1px]")}
    </div>
  );
}

const KEYS: [key: string, label: string, tilt: number, shift: string][] = [
  ["M", "Mute", -4, "-translate-x-10"],
  ["S", "Share screen", 3, "translate-x-12"],
  ["R", "Record", -2, "-translate-x-2"],
];
function KeysVisual() {
  return (
    <div className="flex flex-col items-center gap-3">
      {KEYS.map(([k, label, tilt, shift], i) => (
        // Offset on the wrapper: the float animation owns `translate` on the pill itself.
        <span key={k} className={shift}>
          <span
            style={{ rotate: `${tilt}deg`, animationDelay: `${i * -1.1}s` }}
            className="feat-float flex items-center gap-2.5 rounded-2xl bg-accent px-3 py-2 text-[15px] font-semibold text-accent-foreground shadow-[0_12px_30px_-10px_color-mix(in_oklab,var(--accent)_70%,transparent)]"
          >
            <kbd className="flex size-7 items-center justify-center rounded-lg bg-white/20 font-mono text-[14px]">{k}</kbd>
            {label}
          </span>
        </span>
      ))}
    </div>
  );
}

const ALSO: [typeof Check, string][] = [
  [SlidersHorizontal, "Camera, mic and speaker check before you join"],
  [Smile, "Your mascot stands in when the camera is off"],
  [Smartphone, "Install it on your phone"],
  [Monitor, "Screen-only or audio-only joins"],
  [Clock, "Meetings end on time by themselves"],
  [SunMoon, "Light and dark, everywhere"],
];

export default function Features() {
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
        <Card
          className="md:col-span-4"
          title="Follows the conversation"
          body="The stage moves to whoever is speaking, with a ring around their tile. Pin anyone, or a presentation, to keep them big."
        >
          <Waveform />
        </Card>
        <Card
          className="md:col-span-2"
          title="Record the whole meeting"
          body="Everyone's video, audio and screen in one WebM or MP4, saved to your device and your Google Drive."
        >
          <RecordingVisual />
        </Card>
        <Card className="md:col-span-2" title="You decide who gets in" body="Waiting room, password, room lock. Mute or remove anyone, end it for all.">
          <WaitingRoomVisual />
        </Card>
        <Card className="md:col-span-2" title="Up to 10 people" body="Guests join from a link with just a name. No account, no download.">
          <PeopleVisual />
        </Card>
        <Card className="md:col-span-2" title="Now, later, or on the calendar" body="Every room gets a short code. Add scheduled ones to Google Calendar or any .ics app.">
          <ScheduleVisual />
        </Card>
        <Card
          className="md:col-span-3"
          title="Present with sound"
          body="Share a screen, window or tab with its audio. The presentation takes the stage; the host can stop any share."
        >
          <ShareVisual />
        </Card>
        <Card
          className="md:col-span-3"
          title="Keyboard first"
          body="Mute, camera, share, people, copy link, lock and record each have one key. Press ? in a call for the list."
        >
          <KeysVisual />
        </Card>
      </ul>
      <ul className="mx-auto mt-6 flex max-w-5xl flex-wrap justify-center gap-2">
        {ALSO.map(([Icon, text]) => (
          <li key={text} className="flex items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-[14px]">
            <Icon size={15} className="text-accent" aria-hidden /> {text}
          </li>
        ))}
      </ul>
    </section>
  );
}
