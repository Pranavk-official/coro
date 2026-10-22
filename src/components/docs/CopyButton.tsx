"use client";
import { useState } from "react";
import { Button } from "@heroui/react";
import { Check, Copy } from "lucide-react";

/** `CodeBlock.CopyButton`: copies `code`, shows a check for 1.5 s. */
export default function CopyButton({ code, "aria-label": label = "Copy code", className = "" }: { code: string; "aria-label"?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      isIconOnly
      size="sm"
      variant="ghost"
      aria-label={copied ? "Copied" : label}
      className={`code-block__copy-button size-7 min-w-0 text-muted hover:text-foreground ${className}`}
      onPress={async () => {
        await navigator.clipboard.writeText(code).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </Button>
  );
}
