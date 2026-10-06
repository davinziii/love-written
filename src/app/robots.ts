import type { MetadataRoute } from "next";

/**
 * /s/ is intentionally NOT disallowed: a crawler that somehow finds a link must be able to
 * fetch it to see the noindex/noarchive directives (robots.txt blocks would hide them).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/studio/", "/admin/", "/api/", "/recover"] },
  };
}
