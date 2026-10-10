import { ImageResponse } from "next/og";
import BrandMark from "@/components/layout/BrandMark";
import { SITE } from "@/lib/utils/site";

export const alt = `${SITE.name}: free browser video calls. ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "#f5f5f7",
          background: "radial-gradient(ellipse 80% 70% at 85% 0%, #0a4a8f 0%, #000 70%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <BrandMark size={72} />
          <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: -2 }}>coro</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 92, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>
            Video calls.
          </span>
          <span style={{ fontSize: 92, fontWeight: 700, letterSpacing: -4, lineHeight: 1, color: "#2997ff" }}>
            {SITE.tagline}
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 28, color: "#a1a1a6" }}>
          {["One link", "Guests need no account", "You choose who gets in"].map((t) => (
            <span
              key={t}
              style={{ display: "flex", padding: "10px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)" }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
