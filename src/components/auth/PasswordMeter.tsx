"use client";

/** 0–4: one point each for ≥10 chars (the sign-up minimum), ≥14 chars, a digit, a symbol or mixed case. */
function score(v: string): number {
  return (
    Number(v.length >= 10) +
    Number(v.length >= 14) +
    Number(/\d/.test(v)) +
    Number(/[^a-zA-Z0-9]/.test(v) || (/[a-z]/.test(v) && /[A-Z]/.test(v)))
  );
}

const LEVELS = [
  { label: "At least 10 characters.", color: "" },
  { label: "Weak", color: "bg-danger" },
  { label: "Fair", color: "bg-warning" },
  { label: "Good", color: "bg-warning" },
  { label: "Strong", color: "bg-success" },
];

/** Segmented strength bar (ref kinetics "Password Meter"): filled segments spring in from the left. */
export default function PasswordMeter({ value }: { value: string }) {
  // Under the minimum, at most "Weak" — a long-enough password is what the server actually checks.
  const s = value.length < 10 ? Math.min(score(value), value ? 1 : 0) : score(value);
  const { label, color } = LEVELS[s]!;
  return (
    <span className="flex flex-col gap-1.5">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-[5px] flex-1 overflow-hidden rounded-full bg-default">
            <span
              className={`block h-full origin-left rounded-full transition-[transform,background-color] duration-[350ms,250ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${color}`}
              style={{ transform: `scaleX(${i < s ? 1 : 0})` }}
            />
          </span>
        ))}
      </span>
      <span aria-live="polite">{s && value.length < 10 ? `${label} · at least 10 characters.` : label}</span>
    </span>
  );
}
