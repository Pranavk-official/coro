"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import Particles, { ParticlesProvider } from "@tsparticles/react";
import type { Engine, ISourceOptions } from "@tsparticles/engine";
import { loadSlim } from "@tsparticles/slim";

/** Module-level and stable: ParticlesProvider throws if its init callback changes between renders. */
const init = async (engine: Engine) => {
  await loadSlim(engine);
};

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
 * ui-layouts "Sparkles" on tsParticles v4 (provider API). Starts only once its box is near the viewport and never
 * under prefers-reduced-motion. Options are memoised: `<Particles>` reloads whenever the options object changes.
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
  const [run, setRun] = useState(false);
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
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setRun(true), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
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
        number: { value: density },
        size: { value: { min: size / 1.5, max: size } },
        opacity: { value: { min: 0.1, max: 1 }, animation: { enable: true, sync: false, speed: opacitySpeed } },
        move: { enable: true, direction, straight: true, speed: { min: speed / 130, max: speed } },
      },
    }),
    [color, density, size, speed, opacitySpeed, direction],
  );

  return (
    <div ref={box} aria-hidden className={className}>
      {/* Wait for the colour: changing options while the first load is in flight leaves an empty canvas.
          A new colour (theme switch) remounts instead of reloading the same container. */}
      {run && color ? (
        <ParticlesProvider init={init}>
          <Particles key={color} id={id} options={options} className="h-full w-full" />
        </ParticlesProvider>
      ) : null}
    </div>
  );
}
