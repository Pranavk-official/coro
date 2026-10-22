"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { DOCS_NAV, DOCS_PAGES } from "@/lib/docs/nav";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

function Links({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <div className="flex flex-col gap-4">
      {DOCS_NAV.map((g) => (
        <div key={g.group} className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-[12px] font-semibold tracking-wide text-muted uppercase">{g.group}</p>
          {g.items.map((i) => {
            const on = path === i.href;
            return (
              <Link
                key={i.href}
                href={i.href}
                onClick={onNavigate}
                aria-current={on ? "page" : undefined}
                className={`rounded-xl px-3 py-1 text-[15px] transition-colors ${
                  on ? "bg-accent/12 font-semibold text-accent" : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                {i.title}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Left column on large screens. */
export function DocsSidebar() {
  return (
    <nav aria-label="Docs" className="sticky top-[149px] hidden max-h-[calc(100dvh-149px)] self-start overflow-y-auto pb-6 [scrollbar-width:none] lg:block">
      <Links />
    </nav>
  );
}

/** Phones/tablets: the current page as a button that opens the same list in a bottom drawer. */
export function DocsMobileNav() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const here = DOCS_PAGES.find((p) => p.href === path);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[12px] text-muted">{here?.group ?? "Docs"}</span>
          <span className="block truncate font-semibold">{here?.title ?? "Menu"}</span>
        </span>
        <ChevronDown size={18} aria-hidden />
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="glass">
          <DrawerTitle className="px-5 pt-2 text-[17px]">Docs</DrawerTitle>
          <div className="max-h-[75dvh] overflow-y-auto p-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
            <Links onNavigate={() => setOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
