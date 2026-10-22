import type { MetadataRoute } from "next";
import { SITE } from "@/lib/utils/site";
import { DOCS_PAGES } from "@/lib/docs/nav";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE.url, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE.url}/sign-in`, changeFrequency: "yearly", priority: 0.3 },
    ...DOCS_PAGES.map((p) => ({ url: `${SITE.url}${p.href}`, changeFrequency: "monthly" as const, priority: p.href === "/docs" ? 0.6 : 0.4 })),
    { url: `${SITE.url}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE.url}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
