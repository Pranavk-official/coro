import type { ReactNode } from "react";

/** The landing hero's grid + drifting dust behind a page top, so every page reads as the same site. Parent: `relative isolate`. */
export function PageBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] overflow-hidden">
      <div className="landing-grid absolute inset-0" />
      <div className="landing-dust absolute inset-x-0 top-0 h-[520px]" />
    </div>
  );
}

/** Landing-style page header: pill, bold two-tone heading, one line of lede. */
export default function PageIntro({
  pill,
  title,
  accent,
  children,
  align = "center",
}: {
  pill: ReactNode;
  title: ReactNode;
  accent?: ReactNode;
  children?: ReactNode;
  align?: "center" | "start";
}) {
  const centered = align === "center";
  return (
    <div className={`flex flex-col gap-4 ${centered ? "items-center text-center" : "items-start"}`}>
      <span className="inline-flex items-center gap-2 rounded-full border border-accent/70 bg-background/70 px-3 py-1 text-[13px] backdrop-blur">
        {pill}
      </span>
      <h1 className="text-[36px] leading-[1.05] font-bold tracking-[-0.035em] break-words sm:text-[56px]">
        {title}
        {accent ? (
          <>
            <br />
            <span className="text-accent">{accent}</span>
          </>
        ) : null}
      </h1>
      {children ? <p className={`max-w-xl text-[17px] leading-[1.45] text-foreground/80 sm:text-[19px] ${centered ? "" : ""}`}>{children}</p> : null}
    </div>
  );
}
