import type { ReactNode } from "react";
import { codeToHtml } from "shiki";
import CopyButton from "@/components/docs/CopyButton";

/**
 * Code block with the same anatomy as HeroUI Pro's `CodeBlock` (Root · Header · Code · CopyButton), highlighted by
 * Shiki on the server: no highlighter ships to the browser. Both GitHub themes are emitted as CSS variables and the
 * one matching the site theme is applied, so code follows the light/dark switch.
 */
function Root({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`code-block overflow-hidden rounded-2xl border border-hairline bg-surface ${className}`}>{children}</div>;
}

function Header({ children }: { children: ReactNode }) {
  return (
    <div className="code-block__header flex min-h-10 items-center justify-between gap-3 border-b border-hairline bg-default/60 py-1.5 pl-4 pr-2 font-mono text-[12px] text-muted">
      {children}
    </div>
  );
}

/** Cached (`cacheComponents`): the snippets are static, and Shiki reads the clock, which prerendering forbids outside a cache. */
async function highlight(code: string, lang: string): Promise<string> {
  "use cache";
  return codeToHtml(code, { lang, themes: { light: "github-light", dark: "github-dark" }, defaultColor: false });
}

async function CodeArea({ code, language = "plaintext" }: { code: string; language?: string }) {
  const html = await highlight(code, language);
  return (
    <div
      className="code-block__code overflow-x-auto p-4 font-mono text-[13px] leading-6 [&_pre]:bg-transparent! [&_pre]:outline-none [&_span]:text-(--shiki-light) dark:[&_span]:text-(--shiki-dark)"
      // Shiki output for our own static strings.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export const CodeBlock = Object.assign(Root, { Header, Code: CodeArea, CopyButton });

const LABEL: Record<string, string> = { bash: "terminal", yaml: "yaml", toml: "toml", nginx: "nginx", dotenv: ".env", plaintext: "text" };

/** The common case: a header with the file name (or language), a copy button, and the highlighted code. */
export default function Code({ code, lang = "bash", title }: { code: string; lang?: string; title?: string }) {
  return (
    <CodeBlock>
      <CodeBlock.Header>
        <span className="truncate">{title ?? LABEL[lang] ?? lang}</span>
        <CodeBlock.CopyButton code={code} />
      </CodeBlock.Header>
      <CodeBlock.Code code={code} language={lang} />
    </CodeBlock>
  );
}
