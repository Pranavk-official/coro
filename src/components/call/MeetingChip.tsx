"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

function timeLeft(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} min left`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
}

export default function MeetingChip({
  code,
  expiresAt,
  count,
  max,
}: {
  code: string;
  expiresAt: string | null;
  count: number;
  max: number;
}) {
  const [copied, setCopied] = useState(false);
  const left = timeLeft(expiresAt);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/rooms/${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="glass flex h-10 items-center gap-2 rounded-full pl-1 pr-3 text-sm text-white">
      <button
        type="button"
        onClick={() => void copy()}
        className="press flex h-8 items-center gap-1.5 rounded-full px-3 font-semibold hover:bg-white/10"
        aria-label={copied ? "Link copied" : "Copy meeting link"}
      >
        <code>{code}</code>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      {left ? <span className="hidden text-white/80 sm:inline">{left}</span> : null}
      <span className="text-white/80">
        {count}/{max}
      </span>
    </div>
  );
}
