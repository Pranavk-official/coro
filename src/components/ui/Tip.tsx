"use client";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent } from "@heroui/react";

/** Hover/focus label for an icon control: says what pressing it does right now. */
export default function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip delay={400} closeDelay={0}>
      {children}
      <TooltipContent placement="top" offset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
