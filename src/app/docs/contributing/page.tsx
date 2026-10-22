import type { Metadata } from "next";
import DocPage from "@/components/docs/DocPage";
import Code from "@/components/docs/CodeBlock";
import { C, H2, Note } from "@/components/docs/prose";
import { SITE } from "@/lib/utils/site";

export const metadata: Metadata = { title: "Contributing · Docs", description: "How to contribute to Coro." };

const RULES: [title: string, body: React.ReactNode][] = [
  ["UI", <>HeroUI v3 first, Tailwind for the rest, theme tokens instead of raw colours. Check every change at 375 px and in light and dark. Keep the Meet-simple bar: each screen has one clear next action.</>],
  ["No server actions", <>Mutations are a Hono route plus <C>useMutation</C>. Server Components may read, not write.</>],
  ["Errors", <>Throw the typed errors from <C>src/server/shared/errors.ts</C>. The central handler turns them into <C>{"{ success: false, message, error: { code } }"}</C>; never build an error response by hand.</>],
  ["Validation and limits", <>Every request body goes through zod in the module&apos;s <C>*.schema.ts</C>. Every new route gets a <C>rateLimit(...)</C>, every new socket event a <C>socketLimit(...)</C>.</>],
  ["Imports and types", <>Use <C>@/</C> for anything outside the current folder. Shared types live in <C>src/types/&lt;module&gt;/&lt;name&gt;.ts</C>; files loaded by <C>server.ts</C> stay free of Prisma and React.</>],
  ["Environment", <>A new variable goes into <C>.env.example</C> and <C>dev/.env.dev.example</C> with a one-line comment.</>],
  ["Less code", "Before adding something, check whether it needs to exist, whether the codebase already has it, and whether the platform or an installed dependency covers it."],
];

export default function Page() {
  return (
    <DocPage href="/docs/contributing">
      <H2 id="ways">Ways to help</H2>
      <ul className="ml-5 list-disc space-y-2">
        <li>
          <strong>Report a bug:</strong>{" "}
          <a href={`${SITE.repo}/issues/new/choose`} target="_blank" rel="noopener noreferrer">open an issue</a> with steps
          to reproduce, your browser and OS, and whether it happens every time.
        </li>
        <li><strong>Suggest a feature:</strong> open an issue that describes the problem first. Features need a short design note before code.</li>
        <li><strong>Fix something:</strong> issues labelled <C>good first issue</C> are small and self-contained. Comment so nobody doubles up.</li>
        <li><strong>Improve the docs:</strong> these pages live in <C>src/app/docs/</C>. Fixes from people who deployed Coro are the most useful kind.</li>
      </ul>

      <H2 id="conventions">Conventions</H2>
      <p>Reviews check for these, so following them up front saves a round trip.</p>
      <dl className="flex flex-col divide-y divide-hairline rounded-2xl border border-hairline bg-surface">
        {RULES.map(([t, b]) => (
          <div key={t} className="flex flex-col gap-1 p-4 sm:grid sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
            <dt className="font-semibold">{t}</dt>
            <dd className="text-[15px] leading-relaxed text-muted">{b}</dd>
          </div>
        ))}
      </dl>
      <Note>Coro runs Next.js 16 with <C>cacheComponents</C> on, which behaves differently from older versions. Read the bundled docs in <C>node_modules/next/dist/docs/</C> before Next-specific work.</Note>

      <H2 id="pull-requests">Pull requests</H2>
      <p>Branch from <C>main</C> and keep each pull request to one change. Use Conventional Commits:</p>
      <Code lang="plaintext" title="commit messages" code={`feat(lobby): add a "copy all links" button\nfix(call): keep the pin button clear of the self-view\ndocs(turn): explain TURN_EXTERNAL_IP on Oracle Cloud\ntest(recording): cover the Drive upload failure path`} />
      <p>Before you open it, run:</p>
      <Code code={`bunx tsc --noEmit && bun run lint && bun run test`} />
      <p>
        The template asks what changed, why, how you tested it, and for before/after screenshots of UI changes at 375 px and
        desktop, in both themes. Update the docs and <C>.env.example</C> when setup or behaviour changes, and commit any new
        migration.
      </p>

      <H2 id="security">Security</H2>
      <p>
        Don&apos;t report security problems in public issues. Email{" "}
        <a href="mailto:pranavkcse@gmail.com">pranavkcse@gmail.com</a> with the details and you&apos;ll hear back within a few
        days. Coro is <a href={`${SITE.repo}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">MIT-licensed</a>; by
        contributing you agree your work is released under the same license.
      </p>
    </DocPage>
  );
}
