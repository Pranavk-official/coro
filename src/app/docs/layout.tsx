import type { ReactNode } from "react";
import DocsHeader from "@/components/docs/DocsHeader";
import { PageBackdrop } from "@/components/layout/PageIntro";
import { DocsMobileNav, DocsSidebar } from "@/components/docs/DocsNav";

/** Docs shell: the docs header (search + section tabs), a sidebar of pages, and the page. Same backdrop and tokens as the rest of the site. */
export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <DocsHeader />
      <main className="relative isolate flex flex-1 flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden opacity-60">
          <PageBackdrop />
        </div>
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 pb-20 pt-8 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12 lg:pt-10">{/* lg:pt-10 + header = the 149px the sidebar and "On this page" stick at */}
          <DocsSidebar />
          <div className="flex min-w-0 flex-col gap-6">
            <DocsMobileNav />
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
