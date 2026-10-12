import type { MetadataRoute } from "next";
import { SITE } from "@/lib/utils/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} — video calls`,
    short_name: SITE.name,
    description: SITE.description,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#0066cc",
    categories: ["productivity", "social"],
    // PNGs rendered from app/icon.svg (rsvg-convert); maskable = same art, square corners (mark sits in the safe zone).
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "New meeting", url: "/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }],
  };
}
