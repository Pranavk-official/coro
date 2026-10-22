"use client";
import { useEffect, useState } from "react";
import { AlignLeft } from "lucide-react";
import type { Toc } from "@/lib/docs/nav";

/** Header height + a little air: a section counts as "current" once its heading passes this line. */
const LINE = 160;

/**
 * "On this page", HeroUI-docs style: the section being read is highlighted and its marker slides along the rail.
 * Scroll-driven (rAF-throttled) rather than IntersectionObserver, so short sections and the last one at the
 * bottom of the page still activate.
 */
export default function OnThisPage({ toc }: { toc: Toc }) {
  const [active, setActive] = useState(toc[0]?.[0] ?? "");
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = toc[0]?.[0] ?? "";
      for (const [id] of toc) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= LINE) current = id;
      }
      setActive(atBottom ? (toc.at(-1)?.[0] ?? current) : current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", update);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("hashchange", update);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [toc]);

  if (!toc.length) return null;
  return (
    <nav aria-label="On this page" className="flex flex-col gap-3 text-[14px]">
      <p className="flex items-center gap-2 text-muted">
        <AlignLeft size={16} aria-hidden /> On this page
      </p>
      <ul className="flex flex-col border-l border-hairline">
        {toc.map(([id, label]) => {
          const on = id === active;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={on ? "location" : undefined}
                className={`-ml-px block border-l py-1.5 pl-4 transition-colors duration-200 ${
                  on ? "border-foreground font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
