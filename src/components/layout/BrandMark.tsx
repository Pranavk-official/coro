/** Coro mark: an open ring (the chorus, a C) around a dot (the voice). Same drawing as app/icon.svg; plain SVG so next/og can render it too. */
export default function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="coro-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2997ff" />
          <stop offset="1" stopColor="#0058b8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#coro-g)" />
      <path d="M44.26 21.72 A16 16 0 1 0 44.26 42.28" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
      <circle cx="32" cy="32" r="6" fill="#fff" />
    </svg>
  );
}
