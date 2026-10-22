import type { ReactNode } from "react";
import Link from "next/link";
import { AlignLeft, ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { DOCS_PAGES } from "@/lib/docs/nav";
import { SITE } from "@/lib/utils/site";
import OnThisPage from "@/components/docs/OnThisPage";

/**
 * One docs page: group label, title, lede, body, prev/next, and an "On this page" column (xl). Title, lede and
 * table of contents come from `lib/docs/nav` (the toc ids match the page's `H2`s).
 */
export default function DocPage({ href, children }: { href: string; children: ReactNode }) {
  const i = DOCS_PAGES.findIndex((p) => p.href === href);
  const page = DOCS_PAGES[i]!;
  const prev = DOCS_PAGES[i - 1];
  const next = DOCS_PAGES[i + 1];
  return (
    <div className="grid min-w-0 gap-10 xl:grid-cols-[minmax(0,1fr)_13rem]">
      <article className="flex min-w-0 flex-col gap-5 text-[16px] leading-relaxed [&_a:not(.no-underline)]:text-link [&_a:not(.no-underline)]:underline-offset-2 hover:[&_a:not(.no-underline)]:underline">
        <header className="flex flex-col gap-2 border-b border-hairline pb-6">
          <p className="text-[13px] font-semibold text-accent">{page.group}</p>
          <h1 className="text-[34px] leading-tight font-bold tracking-[-0.03em] sm:text-[40px]">{page.title}</h1>
          <p className="text-[18px] text-foreground/75">{page.description}</p>
        </header>
        {/* Below xl the right column is gone: the same contents, folded, at the top of the page. */}
        {page.toc.length ? (
          <details className="group rounded-2xl border border-hairline bg-surface xl:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[15px] font-medium marker:hidden">
              <span className="flex items-center gap-2"><AlignLeft size={16} aria-hidden /> On this page</span>
              <ChevronDown size={16} aria-hidden className="transition-transform group-open:rotate-180" />
            </summary>
            <ul className="flex flex-col gap-1 border-t border-hairline px-4 py-3 text-[15px]">
              {page.toc.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="no-underline block py-1 text-muted hover:text-foreground">{label}</a>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {children}
        <nav aria-label="Pagination" className="mt-8 grid gap-3 border-t border-hairline pt-6 sm:grid-cols-2">
          {prev ? (
            <Link href={prev.href} className="no-underline group flex flex-col gap-1 rounded-2xl border border-hairline p-4 hover:border-accent/50">
              <span className="flex items-center gap-1 text-[13px] text-muted"><ArrowLeft size={14} aria-hidden /> Previous</span>
              <span className="font-semibold group-hover:text-accent">{prev.title}</span>
            </Link>
          ) : <span />}
          {next ? (
            <Link href={next.href} className="no-underline group flex flex-col items-end gap-1 rounded-2xl border border-hairline p-4 text-right hover:border-accent/50">
              <span className="flex items-center gap-1 text-[13px] text-muted">Next <ArrowRight size={14} aria-hidden /></span>
              <span className="font-semibold group-hover:text-accent">{next.title}</span>
            </Link>
          ) : null}
        </nav>
      </article>
      <aside className="hidden xl:block">
        <div className="sticky top-[149px] flex flex-col gap-6">
          <OnThisPage toc={page.toc} />
          <a href={`${SITE.repo}/tree/main/deploy`} target="_blank" rel="noopener noreferrer" className="text-[14px] text-muted hover:text-foreground">
            deploy/ on GitHub ↗
          </a>
        </div>
      </aside>
    </div>
  );
}
