import type { ReactNode } from "react";
import { Info, TriangleAlert } from "lucide-react";

/** Building blocks for docs pages (no MDX: plain components keep the theme tokens in reach). */

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="group mt-6 scroll-mt-36 text-[24px] leading-tight font-bold tracking-[-0.02em] first:mt-0">
      {children}
      <a href={`#${id}`} aria-label="Link to this section" className="ml-2 text-accent no-underline opacity-0 transition-opacity group-hover:opacity-100">
        #
      </a>
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.01em]">{children}</h3>;
}

/** Inline code: names, values and paths inside a sentence. Anything to copy goes in a `Code` block. */
export const C = ({ children }: { children: ReactNode }) => (
  <code className="rounded-md bg-default px-1.5 py-0.5 font-mono text-[0.88em]">{children}</code>
);

export function Note({ tone = "info", title, children }: { tone?: "info" | "warn"; title?: string; children: ReactNode }) {
  const Icon = tone === "warn" ? TriangleAlert : Info;
  return (
    <div className={`flex gap-3 rounded-2xl border p-4 text-[15px] leading-relaxed ${tone === "warn" ? "border-warning/40 bg-warning/10" : "border-accent/30 bg-accent/8"}`}>
      <Icon size={18} aria-hidden className={`mt-0.5 shrink-0 ${tone === "warn" ? "text-warning" : "text-accent"}`} />
      <div className="flex min-w-0 flex-col gap-2">
        {title ? <strong>{title}</strong> : null}
        {/* Plain block: inline code inside the text must stay inline. */}
        <div>{children}</div>
      </div>
    </div>
  );
}

/** Numbered steps; each step can hold paragraphs and code blocks. */
export function Steps({ children }: { children: ReactNode }) {
  return (
    <ol className="flex list-none flex-col gap-6 border-l border-hairline pl-0 [counter-reset:step]">
      {children}
    </ol>
  );
}
export function Step({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <li className="relative flex flex-col gap-3 pl-8 [counter-increment:step] before:absolute before:-left-3.5 before:top-0 before:flex before:size-7 before:items-center before:justify-center before:rounded-full before:bg-accent before:font-mono before:text-[13px] before:text-accent-foreground before:content-[counter(step)]">
      <strong className="leading-7">{title}</strong>
      {children}
    </li>
  );
}

/** A screenshot in both themes; the one matching the current theme shows. */
export function Shot({ name, alt, caption }: { name: string; alt: string; caption: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-2xl border border-hairline shadow-[0_20px_60px_-30px_color-mix(in_oklab,var(--accent)_60%,transparent)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- static screenshots; next/image adds nothing here */}
        <img src={`/docs/${name}-light.jpg`} alt={alt} width={1440} height={900} loading="lazy" className="block w-full dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/docs/${name}-dark.jpg`} alt={alt} width={1440} height={900} loading="lazy" className="hidden w-full dark:block" />
      </div>
      <figcaption className="text-sm text-muted">{caption}</figcaption>
    </figure>
  );
}

/** Small cards linking onward (used on the introduction). */
export function CardLinks({ items }: { items: { href: string; title: string; body: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((i) => (
        <a key={i.href} href={i.href} className="group rounded-2xl border border-hairline bg-surface p-4 no-underline transition-colors hover:border-accent/50">
          <strong className="block text-foreground group-hover:text-accent">{i.title}</strong>
          <span className="text-[15px] text-muted">{i.body}</span>
        </a>
      ))}
    </div>
  );
}
