import type { MetadataRoute } from "next";
import { SITE } from "@/lib/utils/site";

// Only the landing page is public content; rooms, API and auth flows stay out of search.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/rooms/", "/new", "/check-email", "/magic-link", "/reset-password", "/verify-email", "/forgot-password"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
