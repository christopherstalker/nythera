import type { MetadataRoute } from "next";
import { CANONICAL_SITE_ORIGIN } from "@/lib/site-origin";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/auth/",
        "/chat/",
        "/chats",
        "/create-character",
        "/library",
        "/login",
        "/register",
        "/room/",
        "/rooms",
        "/settings",
        "/character/*/edit",
        "/*?*q=",
        "/*?*tag=",
        "/*?*sort=",
        "/*?*ratingMin=",
        "/*?*nsfw=",
        "/*?*match="
      ]
    },
    sitemap: `${CANONICAL_SITE_ORIGIN}/sitemap.xml`,
    host: CANONICAL_SITE_ORIGIN
  };
}
