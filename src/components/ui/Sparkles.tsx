"use client";
import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Container, ISourceOptions } from "@tsparticles/engine";

const SparklesCanvas = lazy(() => import("@/components/ui/SparklesCanvas"));

const WAKE = ["pointermove", "pointerdown", "scroll", "keydown"] as const;

/** Runs `cb` on the visitor's first interaction: on slow phones the particle loop competed with load (Lighthouse TBT). */
function afterInteraction(cb: () => void) {
  const go = () => {
    stop();
    cb();
  };
  const stop = () => WAKE.forEach((t) => window.removeEventListener(t, go));
  WAKE.forEach((t) => window.addEventListener(t, go, { once: true, passive: true }));
  return stop;
}

type Props = {
  className?: string;
  /** Fixed colour. Omit to use the box's `--sparkle-color` CSS variable (set it per theme with `dark:`). */
  color?: string;
  /** Particle count for the whole area. */
  density?: number;
  size?: number;
  speed?: number;
  opacitySpeed?: number;
  direction?: "top" | "bottom" | "none";
};

/**
 * ui-layouts "Sparkles" on tsParticles v4 (provider API). Starts only after the first interaction, once its box is near
 * the viewport, and never under prefers-reduced-motion. Particle count scales with screen width (phones get fewer). Options are memoised: `<Particles>` reloads whenever the options object changes.
 */
export default function Sparkles({
  className = "",
  color: fixed,
  density = 600,
  size = 1.2,
  speed = 1,
  opacitySpeed = 2,
  direction = "top",
}: Props) {
  const id = `sparkles-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const box = useRef<HTMLDivElement>(null);
  // 0 = not started; otherwise the density scale for this screen.
  const [run, setRun] = useState(0);
  const container = useRef<Container | undefined>(undefined);
  const visible = useRef(false);
  const [themed, setThemed] = useState<string | null>(null);
  const color = fixed ?? themed;

  // Theme colour from CSS, re-read when <html>'s class (light/dark) changes.
  useEffect(() => {
    if (fixed) return;
    const read = () => {
      const v = box.current && getComputedStyle(box.current).getPropertyValue("--sparkle-color").trim();
      if (v) setThemed(v);
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => mo.disconnect();
  }, [fixed]);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = box.current;
    if (!el) return;
    // Start when first near the viewport; afterwards pause off-screen so scrolling past doesn't pay for it.
    const io = new IntersectionObserver(
      ([e]) => {
        visible.current = !!e?.isIntersecting;
        if (visible.current) {
          setRun(Math.min(1, window.innerWidth / 1280));
          container.current?.play();
        } else container.current?.pause();
      },
      { rootMargin: "100px" },
    );
    const stop = afterInteraction(() => io.observe(el));
    return () => {
      stop();
      io.disconnect();
    };
  }, []);

  // Stable: <Particles> reloads whenever this callback's identity changes.
  const onLoaded = useCallback(async (c?: Container) => {
    container.current = c;
    if (!visible.current) c?.pause();
  }, []);

  const options = useMemo<ISourceOptions>(
    () => ({
      background: { color: { value: "transparent" } },
      fullScreen: { enable: false },
      fpsLimit: 60,
      detectRetina: true,
      particles: {
        // v4 moved colour under `paint` (a top-level `color` is silently ignored).
        paint: { fill: { enable: true, color: { value: color ?? "#ffffff" } } },
        number: { value: Math.round(density * run) },
        size: { value: { min: size / 1.5, max: size } },
        opacity: { value: { min: 0.1, max: 1 }, animation: { enable: true, sync: false, speed: opacitySpeed } },
        move: { enable: true, direction, straight: true, speed: { min: speed / 130, max: speed } },
      },
    }),
    [color, density, run, size, speed, opacitySpeed, direction],
  );

  return (
    <div ref={box} aria-hidden className={className}>
      {/* Wait for the colour: changing options while the first load is in flight leaves an empty canvas.
          A new colour (theme switch) remounts instead of reloading the same container. */}
      {run > 0 && color ? (
        <Suspense>
          <SparklesCanvas key={color} id={id} options={options} onLoaded={onLoaded} />
        </Suspense>
      ) : null}
    </div>
  );
}
