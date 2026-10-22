"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@heroui/react";
import { CornerDownLeft, FileText, Hash, Search } from "lucide-react";
import { DOCS_PAGES } from "@/lib/docs/nav";
import { glassBackdrop, glassContainer, glassDialog } from "@/components/ui/glass-overlay";

type Hit = { href: string; title: string; context: string; heading: boolean };

/** Every page and every "On this page" heading; tiny enough to search in the browser. */
const INDEX: (Hit & { text: string })[] = DOCS_PAGES.flatMap((p) => [
  { href: p.href, title: p.title, context: p.group, heading: false, text: `${p.title} ${p.group} ${p.description}`.toLowerCase() },
  ...p.toc.map(([id, label]) => ({ href: `${p.href}#${id}`, title: label, context: p.title, heading: true, text: `${label} ${p.title}`.toLowerCase() })),
]);

function search(q: string): Hit[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return INDEX.filter((h) => !h.heading);
  // Title starts with the query > title contains it > only the description/context does.
  const score = (h: Hit) => {
    const t = h.title.toLowerCase();
    return t.startsWith(words[0]!) ? 2 : t.includes(words[0]!) ? 1 : 0;
  };
  return INDEX.filter((h) => words.every((w) => h.text.includes(w)))
    .sort((a, b) => score(b) - score(a))
    .slice(0, 12);
}

/** Search button (header) + ⌘K / Ctrl K / "/" palette over the docs. */
export default function DocsSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const router = useRouter();
  const hits = useMemo(() => search(q), [q]);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    list.current?.querySelector(`[data-index="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  function go(hit: Hit | undefined) {
    if (!hit) return;
    setOpen(false);
    setQ("");
    router.push(hit.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search docs"
        className="flex h-10 w-full items-center gap-2 rounded-full border border-hairline bg-surface/70 px-3.5 text-[14px] text-muted backdrop-blur transition-colors hover:border-accent/40 hover:text-foreground"
      >
        <Search size={16} aria-hidden />
        <span className="flex-1 text-left max-sm:sr-only">Search docs</span>
        <kbd className="hidden rounded-md border border-hairline px-1.5 font-mono text-[12px] sm:block">Ctrl K</kbd>
      </button>
      <Modal isOpen={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(""); }}>
        <Modal.Backdrop variant="blur" className={glassBackdrop}>
          <Modal.Container placement="top" size="md" className={`${glassContainer} mt-[12vh]`}>
            <Modal.Dialog aria-label="Search docs" className={`${glassDialog} p-0`}>
              <div className="flex items-center gap-3 border-b border-hairline px-4">
                <Search size={18} aria-hidden className="text-muted" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setSel(0); }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") { e.preventDefault(); setSel((n) => Math.min(n + 1, hits.length - 1)); }
                    if (e.key === "ArrowUp") { e.preventDefault(); setSel((n) => Math.max(n - 1, 0)); }
                    if (e.key === "Enter") { e.preventDefault(); go(hits[sel]); }
                  }}
                  placeholder="Search the docs…"
                  aria-label="Search docs"
                  role="combobox"
                  aria-expanded
                  aria-controls="docs-search-results"
                  aria-activedescendant={hits[sel] ? `docs-hit-${sel}` : undefined}
                  className="h-14 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
                />
                <kbd className="rounded-md border border-hairline px-1.5 font-mono text-[12px] text-muted">Esc</kbd>
              </div>
              <ul ref={list} id="docs-search-results" role="listbox" aria-label="Results" className="max-h-[55vh] overflow-y-auto p-2">
                {hits.length === 0 ? (
                  <li className="px-3 py-8 text-center text-[15px] text-muted">No results for “{q}”. Try “TURN”, “nginx”, “Google” or “backup”.</li>
                ) : (
                  hits.map((h, i) => (
                    <li
                      key={h.href}
                      id={`docs-hit-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={i === sel}
                      onMouseMove={() => setSel(i)}
                      onClick={() => go(h)}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${i === sel ? "bg-accent/12 text-accent" : ""}`}
                    >
                      {h.heading ? <Hash size={16} aria-hidden className="shrink-0 opacity-70" /> : <FileText size={16} aria-hidden className="shrink-0 opacity-70" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{h.title}</span>
                        <span className="block truncate text-[13px] text-muted">{h.context}</span>
                      </span>
                      {i === sel ? <CornerDownLeft size={15} aria-hidden /> : null}
                    </li>
                  ))
                )}
              </ul>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
