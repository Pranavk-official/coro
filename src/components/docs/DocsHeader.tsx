"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Rocket, Settings2, Wrench } from "lucide-react";
import { FaGithub } from "react-icons/fa6";
import BrandMark from "@/components/layout/BrandMark";
import ThemeSwitcher from "@/components/layout/ThemeSwitcher";
import DocsSearch from "@/components/docs/DocsSearch";
import { DOCS_NAV, DOCS_PAGES } from "@/lib/docs/nav";
import { SITE } from "@/lib/utils/site";

const ICON = { "Getting started": BookOpen, Deploy: Rocket, Configure: Settings2, Operate: Wrench } as Record<string, typeof BookOpen>;

/**
 * Docs-only header, after HeroUI's docs: brand + search + links on top, section tabs underneath. Sticky, full
 * width, liquid glass: a light 35% tint so the page shows through, heavy blur + saturation, and a top highlight
 * edge (`--glass-highlight`). The app header stays on every other page.
 */
export default function DocsHeader() {
  const path = usePathname();
  const group = DOCS_PAGES.find((p) => p.href === path)?.group;
  return (
    <header className="sticky top-0 z-30 border-b border-(--glass-border) bg-[color-mix(in_oklab,var(--background)_35%,transparent)] pt-[env(safe-area-inset-top)] shadow-[inset_0_1px_0_var(--glass-highlight),0_10px_30px_-18px_rgb(0_0_0/0.35)] backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2 text-[20px] font-bold tracking-tight">
            <BrandMark size={26} />
            <span className="max-sm:sr-only">coro</span>
          </Link>
          <Link href="/docs" className="rounded-full border border-accent/50 px-2 py-0.5 text-[12px] font-medium text-accent">
            Docs
          </Link>
        </div>
        <div className="mx-auto w-full max-w-md">
          <DocsSearch />
        </div>
        <div className="flex items-center gap-2">
          <a
            href={SITE.repo}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Coro on GitHub"
            className="flex h-10 items-center gap-2 rounded-full border border-hairline px-3 text-[14px] text-foreground/80 hover:text-foreground"
          >
            <FaGithub size={16} aria-hidden />
            <span className="max-md:hidden">GitHub</span>
          </a>
          <div className="max-sm:hidden">
            <ThemeSwitcher />
          </div>
          <div className="sm:hidden">
            <ThemeSwitcher collapsed />
          </div>
        </div>
      </div>
      <nav aria-label="Docs sections" className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6">
        <ul className="flex gap-1">
          {DOCS_NAV.map((g) => {
            const Icon = ICON[g.group] ?? BookOpen;
            const on = g.group === group;
            return (
              <li key={g.group}>
                <Link
                  href={g.items[0]!.href}
                  aria-current={on ? "true" : undefined}
                  className={`relative flex h-11 items-center gap-2 whitespace-nowrap px-3 text-[15px] transition-colors ${
                    on ? "font-medium text-foreground" : "text-muted hover:text-foreground"
                  }`}
                >
                  <Icon size={16} aria-hidden className={on ? "text-accent" : ""} />
                  {g.group}
                  {on ? <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
