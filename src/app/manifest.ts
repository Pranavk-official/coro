import type { MetadataRoute } from "next";
import { SITE } from "@/lib/utils/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} — video calls`,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#0066cc",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
