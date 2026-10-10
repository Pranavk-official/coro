import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Full-bleed square: iOS applies its own corner mask. Same mark as app/icon.svg.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg, #2997ff, #0058b8)" }}>
        <svg width="180" height="180" viewBox="0 0 64 64">
          <path d="M44.26 21.72 A16 16 0 1 0 44.26 42.28" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          <circle cx="32" cy="32" r="6" fill="#fff" />
        </svg>
      </div>
    ),
    size,
  );
}
