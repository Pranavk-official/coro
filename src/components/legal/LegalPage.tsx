import type { ReactNode } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import PageIntro, { PageBackdrop } from "@/components/layout/PageIntro";

/** One address for privacy/legal requests, used by both pages. */
export const CONTACT_EMAIL = "pranavkcse@gmail.com";
export const UPDATED = "22 October 2026";

/** /privacy and /terms: landing-style intro, then the text on one surface panel; h2s get mono section numbers like the landing's code panels. */
export default function LegalPage({
  title,
  accent,
  lede,
  children,
}: {
  title: string;
  accent: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="relative isolate flex flex-1 flex-col overflow-hidden">
        <PageBackdrop />
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 pb-16 pt-28 sm:px-6 sm:pt-36">
          <PageIntro pill={<>Last updated {UPDATED}</>} title={title} accent={accent}>
            {lede}
          </PageIntro>
          <article className="flex flex-col gap-4 rounded-[26px] bg-surface p-6 text-[16px] leading-relaxed [counter-reset:legal] sm:p-10 [&_h2]:[counter-increment:legal] [&_h2]:before:mr-3 [&_h2]:before:font-mono [&_h2]:before:text-[0.7em] [&_h2]:before:font-medium [&_h2]:before:text-accent [&_h2]:before:content-[counter(legal,decimal-leading-zero)] [&_a]:text-link [&_a]:underline [&_h2]:mt-6 [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:tracking-[-0.02em] [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
            {children}
          </article>
          <p className="flex flex-wrap gap-x-6 gap-y-2 px-2 text-[14px] text-muted">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground">Contact</a>
          </p>
        </div>
      </main>
    </div>
  );
}
