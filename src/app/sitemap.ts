import type { MetadataRoute } from "next";
import { SITE } from "@/lib/utils/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE.url, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE.url}/sign-in`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
